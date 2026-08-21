-- Scrapbooks and entries, for the hosted version of the journal.
--
-- Run this once against a fresh Supabase project (SQL editor, or `supabase db
-- push`). The older schema.sql covers the parked sticker/worker scaffolding and
-- is unrelated to these tables.
--
-- The rule this schema is built around: a person can only ever see their own
-- scrapbooks and entries. That is enforced twice over — by row level security
-- on every table, and structurally, by a composite foreign key that makes an
-- entry in someone else's scrapbook impossible to write in the first place.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles --

create table if not exists journal_profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '',
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- scrapbooks --

create table if not exists scrapbooks (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users on delete cascade,
  title        text not null default 'My scrapbook',
  subtitle     text not null default '',
  -- One of the notebook formats in lib/journal/sizes.ts.
  page_size    text not null default 'a5',
  cover_color  text not null default '#7c3aed',
  cover_emoji  text not null default '📔',
  -- Set only when a scrapbook is deliberately shared; see shared_scrapbook().
  share_token  text unique,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Redundant on its own, but it gives entries something to point at so they
  -- can prove they belong to the same person. See the composite key below.
  unique (id, owner)
);

create index if not exists scrapbooks_owner on scrapbooks (owner, updated_at desc);
create index if not exists scrapbooks_share_token on scrapbooks (share_token) where share_token is not null;

-- ----------------------------------------------------------------- entries --

create table if not exists entries (
  id           uuid primary key default gen_random_uuid(),
  scrapbook_id uuid not null,
  owner        uuid not null references auth.users on delete cascade,
  -- The calendar day the entry is about, not when it was written.
  date         date not null,
  title        text not null default '',
  body         text not null default '',
  mood         text not null default '',
  -- The entry's photo tray: [{ name, caption, takenAt }].
  photos       jsonb not null default '[]'::jsonb,
  -- The laid-out page, or null until it has been designed. Checked by
  -- sanitizeCanvas on the way in and on the way out, so the shape here is
  -- never trusted.
  canvas       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- The important line in this file. An entry may only sit in a scrapbook
  -- belonging to the same owner: a mismatched pair has nothing to reference,
  -- so the write fails. Policies can be misconfigured; this cannot.
  foreign key (scrapbook_id, owner)
    references scrapbooks (id, owner) on delete cascade
);

create index if not exists entries_scrapbook on entries (scrapbook_id, date desc, created_at desc);
create index if not exists entries_owner on entries (owner);

-- ------------------------------------------------------------- updated_at --

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scrapbooks_touch on scrapbooks;
create trigger scrapbooks_touch before update on scrapbooks
  for each row execute function touch_updated_at();

drop trigger if exists entries_touch on entries;
create trigger entries_touch before update on entries
  for each row execute function touch_updated_at();

-- --------------------------------------------------------- row level security --

alter table journal_profiles enable row level security;
alter table scrapbooks       enable row level security;
alter table entries          enable row level security;

-- `for all` covers select, insert, update and delete. `using` decides which
-- rows are visible; `with check` decides what may be written — both are
-- needed, or someone can write a row they then cannot see.
drop policy if exists "own profile" on journal_profiles;
create policy "own profile" on journal_profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "own scrapbooks" on scrapbooks;
create policy "own scrapbooks" on scrapbooks
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

drop policy if exists "own entries" on entries;
create policy "own entries" on entries
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

-- ------------------------------------------------------------------ sharing --

-- Deliberately NOT an RLS policy on share_token. A policy like
-- "using (is_public)" would let anyone list every shared scrapbook; these
-- functions only answer for a token someone already has.

create or replace function shared_scrapbook(p_token text)
returns table (
  id uuid, title text, subtitle text, page_size text,
  cover_color text, cover_emoji text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.subtitle, s.page_size,
         s.cover_color, s.cover_emoji, s.created_at
  from scrapbooks s
  where s.share_token = p_token
    and s.is_public
    and p_token is not null
    and length(p_token) >= 16;
$$;

create or replace function shared_entries(p_token text)
returns table (
  id uuid, date date, title text, body text, mood text,
  photos jsonb, canvas jsonb, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.date, e.title, e.body, e.mood, e.photos, e.canvas, e.created_at
  from entries e
  join scrapbooks s on s.id = e.scrapbook_id
  where s.share_token = p_token
    and s.is_public
    and p_token is not null
    and length(p_token) >= 16
  order by e.date desc, e.created_at desc;
$$;

revoke all on function shared_scrapbook(text) from public;
revoke all on function shared_entries(text) from public;
grant execute on function shared_scrapbook(text) to anon, authenticated;
grant execute on function shared_entries(text) to anon, authenticated;

-- ------------------------------------------------------- a home on sign-up --

-- A new account starts with a profile and one scrapbook, so the shelf is never
-- empty and nothing has to guess whether to create one.
create or replace function handle_new_journal_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into journal_profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;

  insert into scrapbooks (owner, title)
  values (new.id, 'My scrapbook');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_journal on auth.users;
create trigger on_auth_user_created_journal
  after insert on auth.users
  for each row execute function handle_new_journal_user();


-- ------------------------------------------------------ connected accounts --

-- One row per person per service. The local backing keeps a single file, which
-- is right for one person and wrong the moment there are accounts: everyone
-- would share one Spotify connection.
--
-- Refresh tokens are long-lived credentials. The app refuses to write one here
-- unless TOKEN_ENCRYPTION_KEY is set, so `refresh_token` holds ciphertext, not
-- a usable secret. Row level security decides who can read the row at all.
create table if not exists journal_connections (
  owner         uuid not null references auth.users on delete cascade,
  provider      text not null check (provider in ('google', 'spotify', 'steam', 'strava')),
  refresh_token text,
  encrypted     boolean not null default false,
  access_token  text,
  -- Epoch milliseconds, matching what the app works in.
  expires_at    bigint,
  -- An identifier that isn't a secret, such as a SteamID.
  account_id    text,
  label         text,
  connected_at  timestamptz not null default now(),
  primary key (owner, provider)
);

alter table journal_connections enable row level security;

drop policy if exists "own connections" on journal_connections;
create policy "own connections" on journal_connections
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));


-- ------------------------------------------------------ pictures on a share --

-- A shared page still has to show its pictures, and a visitor has no session,
-- so the private bucket policies cannot help them. This says whose folder a
-- named picture is in, but only when that picture belongs to an entry in a
-- scrapbook that is actually shared. The route then streams it.
--
-- It answers with an owner, never with a file, and never for a picture that
-- isn't on a shared page — so knowing a file name is not enough to read one.
create or replace function shared_photo_owner(p_token text, p_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.owner
  from entries e
  join scrapbooks s on s.id = e.scrapbook_id
  where s.share_token = p_token
    and s.is_public
    and p_token is not null
    and length(p_token) >= 16
    -- The picture must be in that entry's tray, or drawn on its page.
    and (
      e.photos @> jsonb_build_array(jsonb_build_object('name', p_name))
      or e.canvas::text like '%' || p_name || '%'
    )
  limit 1;
$$;

revoke all on function shared_photo_owner(text, text) from public;
grant execute on function shared_photo_owner(text, text) to anon, authenticated;

-- --------------------------------------------------------------- pictures --

-- Photos live in a private bucket, one folder per person. The app serves them
-- through /api/photos/<name> rather than handing out signed URLs, so access is
-- decided in one place and a saved page never carries an expiring address.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "own photos read" on storage.objects;
create policy "own photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own photos write" on storage.objects;
create policy "own photos write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own photos delete" on storage.objects;
create policy "own photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
