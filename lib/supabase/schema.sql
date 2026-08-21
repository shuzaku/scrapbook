-- ============================================================
-- Scrapbook App — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enums
CREATE TYPE provider_type AS ENUM ('spotify', 'steam', 'youtube', 'instagram', 'google_maps');
CREATE TYPE generation_status AS ENUM ('pending', 'generating', 'done', 'failed');

-- ============================================================
-- profiles — extends auth.users
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'preferred_username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- connected_accounts — OAuth tokens per provider per user
-- ============================================================
CREATE TABLE connected_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider          provider_type NOT NULL,
  provider_user_id  TEXT,
  access_token      TEXT,         -- AES-256-GCM encrypted
  refresh_token     TEXT,         -- AES-256-GCM encrypted
  token_expires_at  TIMESTAMPTZ,
  scopes            TEXT[],
  last_synced_at    TIMESTAMPTZ,
  needs_reauth      BOOLEAN DEFAULT FALSE,
  extra_data        JSONB,        -- provider-specific (e.g. steam_id, display_name)
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own connected accounts" ON connected_accounts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- events — normalized activity from all providers
-- ============================================================
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider         provider_type NOT NULL,
  event_type       TEXT NOT NULL,     -- e.g. 'top_track', 'achievement_unlocked', 'liked_video'
  occurred_at      TIMESTAMPTZ NOT NULL,
  month_key        TEXT NOT NULL,     -- 'YYYY-MM', indexed
  raw_data         JSONB NOT NULL,    -- provider-specific payload
  display_title    TEXT,
  display_subtitle TEXT,
  thumbnail_url    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX events_user_month ON events(user_id, month_key);
CREATE INDEX events_occurred_at ON events(occurred_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert events" ON events FOR INSERT WITH CHECK (TRUE);

-- ============================================================
-- stickers — generated PNG card per event
-- ============================================================
CREATE TABLE stickers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID REFERENCES events(id) ON DELETE SET NULL,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id         TEXT NOT NULL,
  image_url           TEXT,
  generation_status   generation_status DEFAULT 'pending',
  generated_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stickers" ON stickers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage stickers" ON stickers FOR ALL WITH CHECK (TRUE);

-- ============================================================
-- scrapbooks — monthly canvas per user
-- ============================================================
CREATE TABLE scrapbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_key     TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT 'My Scrapbook',
  canvas_state  JSONB,           -- full Konva stage JSON
  thumbnail_url TEXT,
  share_token   TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'base64url'),
  is_public     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX scrapbooks_user_month ON scrapbooks(user_id, month_key);
CREATE INDEX scrapbooks_share_token ON scrapbooks(share_token);

ALTER TABLE scrapbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own scrapbooks" ON scrapbooks FOR ALL USING (auth.uid() = user_id);

-- Public share access (bypasses RLS via security definer function)
CREATE OR REPLACE FUNCTION get_public_scrapbook(p_share_token TEXT)
RETURNS TABLE (
  id UUID, user_id UUID, month_key TEXT, title TEXT,
  canvas_state JSONB, thumbnail_url TEXT, is_public BOOLEAN
) SECURITY DEFINER AS $$
  SELECT id, user_id, month_key, title, canvas_state, thumbnail_url, is_public
  FROM scrapbooks
  WHERE share_token = p_share_token AND is_public = TRUE;
$$ LANGUAGE SQL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scrapbooks_updated_at
  BEFORE UPDATE ON scrapbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- scrapbook_stickers — placement index (canvas_state is source of truth)
-- ============================================================
CREATE TABLE scrapbook_stickers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrapbook_id  UUID NOT NULL REFERENCES scrapbooks(id) ON DELETE CASCADE,
  sticker_id    UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  position_x    FLOAT DEFAULT 0,
  position_y    FLOAT DEFAULT 0,
  rotation      FLOAT DEFAULT 0,
  scale_x       FLOAT DEFAULT 1,
  scale_y       FLOAT DEFAULT 1,
  z_index       INT DEFAULT 0,
  note_text     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scrapbook_stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own scrapbook stickers" ON scrapbook_stickers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM scrapbooks s WHERE s.id = scrapbook_id AND s.user_id = auth.uid())
  );
