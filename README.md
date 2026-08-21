# Scrapbook

A journaling scrapbook. Keep as many books as you like; each holds entries,
and each entry gets a page you lay out in a drag-and-drop editor. Then flip
through the finished book.

    Shelf  →  Scrapbook  →  Entry  →  Page

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. **No API keys, database or accounts are needed** —
entries live in `.data/entries.json` and uploaded photos in `.data/uploads/`,
both gitignored and local to your machine.

## What's here

| Route                | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `/`                  | The shelf: every scrapbook, most recent first        |
| `/book/new`          | Start a scrapbook (name, subtitle, cover)            |
| `/book/[id]`         | One book's entries, newest first, grouped by month   |
| `/book/[id]/read`    | **Flip through** the book, one page at a time        |
| `/book/[id]/new`     | Compose an entry in that book                        |
| `/book/[id]/edit`    | Rename, recolour, or delete the book                 |
| `/entry/[id]`        | Read one entry — shows its page; edit or delete      |
| `/entry/[id]/design` | **The page editor** — drag, drop, resize, rotate     |
| `/entry/[id]/edit`   | Change an entry, add photos, remove photos           |
| `/api/photos`        | `POST` uploads a photo and adds it to an entry       |
| `/api/photos/[name]` | Serves photos out of `.data/uploads`                 |

## Deleting

Entries can be deleted from the entry itself or from the book's list; scrapbooks
from the shelf or from Book settings. The buttons are always visible, not
hidden behind a hover.

Deleting is permanent, so each one opens a dialog naming exactly what will go —
*"Its 3 entries, their pages and their photos go too."* — with **Cancel** and a
red confirm. The dialog waits as long as you do; `Esc` or a click outside backs
out.

An entry takes its page and photos with it; a scrapbook takes every entry
inside. Afterwards a sweep removes upload files nothing references any more —
skipping anything less than an hour old, so an image an open editor has just
fetched is never pulled out from under it.

## Scrapbooks

Every entry belongs to exactly one scrapbook — a book per trip, per year, per
anything. Books are stored in `.data/scrapbooks.json`; entries carry a
`scrapbookId`. Deleting a book deletes its entries, their pages and their
photos, and the settings screen says how many before you do it.

Entries written before books existed are gathered into one called *My
scrapbook* the first time the app reads them. That migration runs at most once
per process — two pages loading in parallel would otherwise each mint a
different book id.

## Flipping through

`/book/[id]/read` opens the book at its cover and turns one page at a time —
`←` / `→`, `PageUp` / `PageDown`, space, or the arrows either side. Entries
with a laid-out page show it; entries without show their writing set on paper,
at the same proportions, so everything flips alike. The turn animation respects
`prefers-reduced-motion`.

From a single entry, **Flip from here** opens the reader at that page
(`?at=<entryId>`), and the entry itself carries previous/next links to its
neighbours with its position in the book. Both use the same order as the
reader — oldest first — so "next" means the same thing everywhere.

## Page sizes

A scrapbook is made at a notebook format, chosen when you start it (and
changeable in its settings). Pages are laid out at 150 DPI, so the numbers are
real paper dimensions:

| Format | Size | Pixels | Good for |
| --- | --- | --- | --- |
| Pocket / Field Notes | 3.5 × 5.5 in | 525 × 825 | Quick lists, pocket carry, sudden ideas |
| A6 | 4.1 × 5.8 in | 615 × 870 | Travel logs, small handwriting, easy bag carry |
| B6 | 4.9 × 6.9 in | 735 × 1035 | Roomier than A6, still portable |
| A5 | 5.8 × 8.3 in | 870 × 1245 | Daily diaries and bullet journals — the default |
| B5 | 6.9 × 9.8 in | 1035 × 1470 | Desk writing, creative spreads, large handwriting |
| A4 | 8.3 × 11.7 in | 1245 × 1755 | Heavy desk use, big sketches, structural layouts |

New elements scale to the page, so a photo takes up a similar share of a
Pocket page as it does of an A4 one. Changing a book's format applies to pages
made from then on — existing pages keep the size they were laid out at, and the
reader draws each page at its own shape rather than squashing it.

## Zooming

Both the editor and the reader zoom the same way: the **−／＋** buttons in the
header, the percentage button to snap back to fit, **Ctrl+scroll**, and the
keyboard — `Ctrl` `+` / `-` / `0` in the editor, plain `+` / `-` / `0` in the
reader. Past fit, the page scrolls inside its frame.

## The page editor

Each entry gets a page at its book's format, arranged by hand. The left rail holds eight
kinds of element — **text**, **photos**, **stickers**, **shapes**, **washi
tape**, **places**, **songs** and **games** — plus paper colours and textures. Drag one onto the page, or click it to
drop it in the middle.

Once something is on the page: drag to move (it snaps to the page's centre
lines), drag the eight grips to resize, drag the handle above it to rotate,
double-click text to write in it. The bar above the page changes with what's
selected — fonts and ink for text, frames and captions for photos (including a
polaroid), fills for shapes and tape.

| Shortcut                | |
| ----------------------- | --------------------------- |
| `Del` / `Backspace`     | Delete the selection        |
| Arrows / `Shift`+arrows | Nudge by 1px / 10px         |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo               |
| `Ctrl+D`                | Duplicate                   |
| `[` / `]`               | Send backward / bring forward |
| `Shift` while resizing  | Keep the aspect ratio       |
| `Shift` while rotating  | Snap to 15°                 |
| `Esc`                   | Deselect                    |

Edits save themselves a moment after you stop — the header says when.

Storage is behind one module, [`lib/journal/store.ts`](lib/journal/store.ts).
It is the only place that touches the filesystem, so moving to a hosted
database later means reimplementing those functions and nothing else. Pages
arrive from the browser as JSON and are run through `sanitizeCanvas` in
[`lib/journal/canvas.ts`](lib/journal/canvas.ts) before anything is written.

## Google Photos (optional)

Photos come in through the **Picker API**. It uses the **Picker API**, not the old Library
API — Google closed the library-wide read scopes to third-party apps in 2025,
so you choose photos in Google's own picker and the app only ever receives
what you picked.

Without credentials the journal behaves exactly as before and
*Settings → Integrations* shows the setup steps. To switch it on: enable the
**Photos Picker API** in Google Cloud, create a Web application OAuth client
with redirect URI `http://localhost:3000/api/integrations/google/callback`, add
the scope `.../auth/photospicker.mediaitems.readonly`, add yourself as a test
user, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.

Once connected, the editor's **Photos** tab gains *Import from Google Photos*,
which opens an in-app panel that runs the whole thing. Google's picker can't be
embedded — it refuses to render in a frame and ships no widget — so the
choosing happens in a popup window, opened with `/autoclose` so Google shuts it
again as soon as you're done. The panel can re-open a blocked or closed window,
and offers a QR code to pick on a phone instead. Your picks download into the
entry's tray (bounded to 25 per pick, at most 2048px, images only) and appear
as thumbnails in the panel, ready to drag onto the page.

Anything that can't be imported is listed with the reason — unsupported type,
too large, download failed — rather than failing silently.

**No location data.** Google strips it from API-served bytes, the Picker's
metadata has no location field, and asking for a resized copy re-encodes the
image anyway. What *does* survive is the capture time — from the picked item's
`createTime`, and from EXIF `DateTimeOriginal` on manual uploads. So each photo
carries a `takenAt`, which powers two things: after an import, the panel offers
to re-date the entry to the day the photos were taken, and a polaroid caption
can be filled from it in one click.

EXIF timestamps have no timezone, so they're stored and rendered as the
camera's wall clock — never converted to local time, which near midnight would
move a photo onto the wrong day.

The refresh token lives in `.data/connections.json`, encrypted with AES-256-GCM
when `TOKEN_ENCRYPTION_KEY` is set and stored as plain text when it isn't. The
settings screen says which. If Google ever rejects the token, the connection
clears itself and asks you to reconnect.

## Google Maps (optional)

The editor's **Places** tab looks up a shop, restaurant or landmark by name and
sticks it on the page in one of three forms:

| | |
| --- | --- |
| **Pin** | A badge with the place's name and address — no image, no API call |
| **Map** | A map cut-out centred on the spot, with a marker and a caption |
| **Code** | A QR code that opens the place when scanned |

All three link to the place on Google Maps: **click** one on a finished page
(or in the flip-through) and it opens; **scan** the code and your phone does.
The link is the `googleMapsUri` Google returns for that exact place, so it
lands on the place itself rather than a text search. In the editor a click
selects instead, and thumbnails aren't links.

Switching a placed sticker between pin / map / code re-uses what it already
has and fetches only what's missing. Zoom and style are adjustable on a map.

Setup: enable **Maps Static API** (for the cut-outs) and **Places API (New)**
(for the lookup) in Google Cloud — Maps requires **billing** on the project
even inside the free allowance — then create an **API key** and set it:

```
GOOGLE_MAPS_API_KEY=...
```

A plain API key, separate from the OAuth client Photos uses. Every call happens
on the server, so the key never reaches the browser, and each map or code is
stored in `.data/uploads` — a finished page keeps them with no Google access at
all. If only the Static API is enabled, lookups fall back to a plain Maps
search so the stickers still work; QR codes are generated locally and need no
key whatsoever.

Stored links are restricted to Google's own hosts when a page is read back, so
a tampered page can't turn a sticker into a link somewhere else. Images a page
stops referencing — a deleted sticker, or the old map after a zoom change —
are removed when it saves.

## Spotify (optional)

The editor's **Music** tab puts a song on the page — picked from what you've
listened to recently, or typed in by hand. It sticks the track on — as a **card** (cover art, title, artist, played date) or as
the **bare album cover** to tape and rotate like a photo. Both open the track in
Spotify when the finished page is read.

There are three ways in, and the first needs no account of any kind:

1. **Search by song or artist.** Apple's iTunes Search API is open — no key, no
   sign-in, no subscription — and returns the title, artist, album, a link to
   the track and 600px cover art. Limited to roughly 20 searches a minute, so
   it searches on submit rather than on every keystroke.
2. **Your recently played**, if Spotify is connected — better when available,
   since it knows what you actually listened to and when.
3. **By hand**, for anything the search cannot find: title, artist, an optional
   link and cover art you upload. With no cover the sticker shows the title on
   a plain sleeve.

Each sticker records which service it came from, so its mark matches its link —
an Apple Music track never shows a Spotify badge. Links are restricted to those
services' own hosts when a page is read back.

Reading your listening uses only `GET /me/player/recently-played`, with the
single scope `user-read-recently-played`. Nothing is written to your account,
and nothing beyond your recent plays is read.

Setup: create an app at developer.spotify.com, tick **Web API**, register the
redirect URI `http://127.0.0.1:3000/api/integrations/spotify/callback` — it has
to be the **IP literal**, since Spotify stopped accepting the `localhost` alias
in November 2025 — add your own account under **Users and Access** (an app in
development mode only works for accounts you list there, up to 25), then set:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

**Spotify Premium is required** — not for you as a listener, but for the account
that *owns* the Spotify app. Without it the Web API answers every request with
`403 Active premium subscription required for the owner of the app`. Spotify's
wording is passed straight through to the Music tab rather than guessed at.

Because the redirect URI is on 127.0.0.1 and cookies are scoped per origin, the
connect flow moves you from `localhost` to `127.0.0.1` automatically and the
whole handshake happens there. Your data is the same either way — only the OAuth
round-trip cares. `next.config.ts` allows 127.0.0.1 as a dev origin so Fast
Refresh keeps working while you're on it.

Cover art is downloaded server-side and stored **exactly as served** — Spotify's
terms don't allow altering it — so a finished page keeps its art with no Spotify
access, and each sticker carries the required attribution and link back. Unlike
Google's test mode, Spotify refresh tokens don't expire on a timer.

## Steam (optional)

The editor's **Games** tab puts a game on the page — as **box art** (the tall
library cover), a **card** with the banner and hours played, or an
**achievement badge** with its icon, name, the day you unlocked it and **how
rare it is** (*"3.9% of players"*, highlighted under 10%). A game's official
**screenshots** can also be dropped on as ordinary photos, so they frame and
caption like any other picture.

Cards prefer **lifetime** hours over the fortnight's — a total says more about
a year than a week does.

**Searching the store, its screenshots and achievement rarity all need nothing
at all** — no key, no sign-in — so most of the tab works out of the box. Signing in adds two things only your own account knows:
what you actually played in the last fortnight, and which achievements you
unlocked.

Setup: get a key at `steamcommunity.com/dev/apikey` (Steam only issues one to a
non-limited account — one that has spent at least $5), set your profile's
**Game details** to Public, then:

```
STEAM_API_KEY=...
```

Steam uses **OpenID, not OAuth**: there's no consent screen, no redirect URI to
register, and no tokens to store or refresh — only your SteamID is kept, and
the app calls Steam with its own key. The identity Steam sends back is verified
with Steam before it's believed, since a claimed id is otherwise just a query
parameter anyone could edit.

If your profile isn't public, Steam returns an empty list rather than an error,
so the tab says that outright instead of looking broken.

Artwork comes from Steam's public CDNs and is stored locally like everything
else. Note that Steam serves **achievement icons from `steamcdn-a.akamaihd.net`**
rather than the `steamstatic.com` host used for store art — both are on the
fetch allow-list, matched on the exact hostname so the wider akamaihd.net
shared CDN isn't trusted.

## Embeds — YouTube, X and Instagram

Paste a link in the Photos tab and it goes on the page as a live frame. No
account, no key, no app registration: all three serve a frameable page for
anything public, with no `X-Frame-Options` and no `frame-ancestors` to stop it.

| Paste | Gets |
| --- | --- |
| `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, `/live/…` | the player, keeping a `?t=` start time |
| `x.com/…/status/…` or `twitter.com/…` | the tweet, with its replies and counts |
| `instagram.com/p/…`, `/reel/…`, `/tv/…` | the post with its caption |

Whatever is pasted, only the id is stored and the link is rebuilt from it, so a
saved element can only ever point at the thing it claims to be. Share-link
tracking, mobile hosts and missing schemes are all handled.

This is the one element that isn't yours to keep. Photos, cover art and map
images are downloaded and stored in `.data/`, so a finished page stands on its
own. An embed is a window: if the post comes down, the account goes private, or
you're offline, the frame is empty. The panel says so, and suggests saving the
picture and uploading it for anything meant to last. Only **public** things
embed — a private account's post or an unlisted video shows the service's own
"unavailable" card.

Some care in the frame itself. Each one is sandboxed to
`allow-scripts allow-same-origin allow-popups`, which is enough for the
service's own script and not enough to navigate the page it sits on. YouTube is
loaded from **youtube-nocookie.com**, which doesn't set tracking cookies until
a video actually plays, and the tweet frame asks for **Do Not Track**. Video
gets `fullscreen` and `encrypted-media` but deliberately **not** autoplay, so a
page never starts making noise on its own. In the editor a frame ignores the
mouse so the element stays draggable; on a finished page it's live.

## Shelf — books, films, anime and manga

The Shelf tab looks something up and puts it on the page: either the bare
cover, or a card with the title, whoever made it, the year, one line of detail
and the score beside it. Add a line of your own in the note and it sits
underneath in italics.

Four buttons, three services, no keys anywhere:

| | Service | Gives |
| --- | --- | --- |
| Books | Open Library | author, year, page count, jacket |
| Films | Cinemeta | director, year, runtime, IMDb rating, poster |
| Anime | AniList | studio, year, episode count, score, cover |
| Manga | AniList | author, year, chapter count, score, cover |

All three take anonymous requests, so the whole tab works the moment the app
starts — like Places and Music, and unlike Google Maps or Spotify. Covers are
downloaded server-side and stored in `.data/` like every other picture, so a
finished page keeps its artwork with no network. Anything with no cover in the
catalogue gets a plain board with the title set in serif rather than a broken
image.

Clicking an item on a finished page opens its entry on whichever service found
it. Only the id is trusted: each link is rebuilt from it when the page saves,
so a tampered address can't survive a round-trip.

Switching between the four buttons re-runs the search you already typed, since
half the time you go looking for a book and remember it was a film.

### Why these three

- **Goodreads** has no usable API. Amazon stopped issuing keys in December 2020
  and took the developer portal down; the endpoint still answers `401 Invalid
  API key` to remind you. Your own shelves are still exportable as CSV, which
  is the only route to your ratings and dates read.
- **Google Books** has richer metadata, but its keyless path shares one quota
  across every anonymous caller and answers `429` as often as not.
- **TMDB and OMDb** both want an API key, and Apple's own movie search answers
  zero for almost anything since they restricted the `media=movie` filter —
  which is how Cinemeta, a public metadata endpoint carrying IMDb ids, ended up
  being the keyless way to find a film.
- **Jikan**, the MyAnimeList wrapper, was the other candidate for anime and
  manga. It was answering `504` from MAL's side while this was written, and it
  depends on a service it doesn't control. AniList answers anonymous GraphQL
  queries directly.

## iCloud photos

Apple has no photos API for anyone outside a native app: iCloud Photos is
closed, and PhotoKit only exists in Swift, on the device. A **Shared Album**
with its public website turned on is the exception — the page Apple serves is
backed by an endpoint that asks for no credentials, only the album's own
token. That makes it the one route from an iPhone into this app without a
developer membership or a data export.

On your iPhone: *Photos → an album → the people icon → **Public Website***,
then copy the link. Paste it into *Photos → Import from an iCloud album* in
the page editor. Captions and dates come across with each picture, and only
the ones you click are downloaded and kept.

What this does and doesn't reach: **only that album**, and only while you leave
sharing switched on. Turn the public website off and the link stops working,
here and everywhere else. Nothing else in your library is visible, and no
account or password is involved at any point.

The album is read on the server, because Apple's endpoint refuses browser
requests from another origin. None of the protocol is documented, so it is
handled defensively: unexpected shapes are skipped rather than trusted, the
330 redirect Apple uses to name the album's real server is followed but only
to a host on `icloud.com`, and a picture's address is checked against
`*.icloud-content.com` before the server will fetch it. Videos are skipped,
since a page takes stills.

The renditions Apple serves have had their EXIF stripped, so the date comes
from the album's own metadata, kept as wall-clock time the way an EXIF
timestamp is.

### What Apple charges for

The Music tab's search *is* Apple — the iTunes Search API, which needs no key.
Anything personal does: your library, recently played and playlists all live
behind the Apple Music API, whose developer token requires **Apple Developer
Program membership at $99 a year**. That is the difference from Spotify, where
registering an app is free. Nothing here uses it.

## Weather

The Places tab can say what the weather actually was on the day an entry is
about — not a forecast, the record. Type a town, pick it from the matches, and
put it on the page as a one-line tag or a little card: the day's high and low,
what the sky was doing, and the rain if there was any.

The date comes from the entry itself, so the only thing to supply is where you
were. Both halves are **Open-Meteo** — its geocoder finds the town and its
archive holds the weather — and neither needs a key, so this works even without
the Google Maps one. °C and °F both, switchable after the fact.

The archive stops a couple of days short of today, so anything more recent
falls back to the forecast endpoint, which also carries the near past. Dates
before the record begins come back with Open-Meteo's own explanation rather
than an empty sticker.

## Letterboxd

The Shelf tab's search finds any film; **Films you watched** finds *yours*.
Give it a Letterboxd username and it reads the public RSS feed at
`letterboxd.com/<you>/rss/` — the last thirty things you logged, with your own
star rating, the date you watched, and whether it was a rewatch.

Letterboxd's real API has been in closed beta for years and needs approval per
application. The member feed needs nothing at all, and carries the part worth
having in a journal. Films arrive as ordinary shelf stickers, so they sit
alongside anything found through search; the poster is downloaded and kept
locally like every other picture, the sticker links back to your own entry for
the film, and the detail line reads "watched 12 Aug" or "rewatched 12 Aug".

Star ratings are out of five and everything else on a shelf card is out of ten,
so yours is doubled to match — four stars shows as ★ 8.0.

The feed is read on the server, since it sends no CORS headers, and parsed
narrowly: entries that aren't a watch (lists, written reviews) are skipped, a
poster is only accepted from Letterboxd's own image host, and a link that
points anywhere but letterboxd.com is dropped rather than followed.

The username is remembered in the browser so you only type it once.

## Strava (optional)

The Moves tab puts your runs and rides on a page. Two shapes: the **route on
its own**, or a **card** with the route beside the distance, time, pace and
climb. Both link back to the activity on Strava.

The route is the good part. Strava sends each activity's shape as an encoded
polyline, which is decoded and drawn as an **SVG path** — so the route is
vector art, not a picture. Nothing is downloaded, no map tiles are fetched, no
Maps key is involved, and it stays sharp however large the sticker gets. Long
rides are thinned to a few hundred points before drawing, which is invisible at
sticker size and keeps the path small. Indoor sessions have no route, so those
show the sport instead of an empty square.

Distances read in km or miles, switchable, and pace is worked out from moving
time rather than elapsed, which is what a runner expects.

Setup is the easiest of any account here: registering is free and instant, with
no membership fee, no approval queue, and no subscription requirement.

1. Make an app at `strava.com/settings/api`.
2. For **Authorization Callback Domain**, put just the domain with no scheme
   or path — `localhost` for local work. Strava registers a domain rather than
   a full address, which is why the app can send you to whatever port it is on.
3. Put the Client ID and Secret in `.env.local` and restart.
4. Leave **View data about your activities** ticked on the consent screen. If
   it is unticked the connection succeeds but there is nothing to read, so the
   callback checks the granted scopes and says so rather than showing an empty
   list.

Two details worth knowing. The scope asked for is `activity:read_all`, which
includes activities you have marked private — `activity:read` alone silently
skips them, and a missing run looks like a bug. And Strava's access tokens last
**six hours**, far shorter than Spotify's, handing back a **new refresh token**
on every refresh; storing the new one is not optional, since keeping the old one
breaks the next refresh.

### What Strava can't give you

Not the Apple Fitness rings. Those are Move, Exercise and Stand, and they live
in HealthKit as a daily activity summary — on the device, with no server behind
them. Strava stores workouts, which is a different thing. The rings can only be
reached through a Health export or an Apple Shortcut; neither is built here.

## Suggestions (optional)

The **Ideas** tab reads an entry and suggests what else might go on the page:
the weather that day, the restaurant that gets a mention, the film described
but never named, a question worth answering in your own words. Each suggestion
opens the tab that can actually fetch it, with the search already filled in \u2014
so "add the noodle place on Bellaire" becomes one click into Places.

### What leaves the machine

This is the only feature here that sends anything anywhere, and it is worth
being plain about. Everything else fetches things *in* and stores them locally.
This sends *out*: the entry's date, title, mood and body text, its photo
captions, and a list of what is already on the page. **No images are sent**, no
file names, and nothing at all until you press the button.

It needs an Anthropic key, and it costs money per press \u2014 the only thing in
the journal that does:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Without the key the tab explains itself and everything else works exactly as
before.

### How it behaves

Suggestions are grounded in the entry and nothing else \u2014 the model is told to
name only things the entry itself mentions, and to turn a guess into a question
rather than assert a fact about someone's life. It is also told that the
entry's words are the person's own writing, to be read and never followed as
instructions, so a page that happens to contain something command-shaped is
treated as what it is: something they wrote that day.

The reply is a fixed shape (structured outputs, so it parses or fails loudly
rather than half-working), the request runs with adaptive thinking at medium
effort, and server-side fallbacks are on \u2014 if a safety classifier declines the
request, the API re-runs it on another model inside the same call instead of
handing back nothing. A refusal that survives that is reported as one rather
than shown as an empty list.

Nothing is ever added to a page automatically. A suggestion is a button.

## Hosting it for other people

The journal runs two ways off the same code. With no Supabase credentials
everything lives in a gitignored `.data/` folder — no accounts, no database, no
network, which is the default and what the rest of this README describes. With
them, the same calls go to Postgres and Supabase Storage, scoped to whoever is
signed in.

Nothing outside two files knows which is in use. `lib/journal/store.ts` is a
dispatcher over `store-local.ts` and `store-cloud.ts`, and `lib/connections.ts`
does the same for connected accounts. The two backings are held to the same
shape by the type system:

```ts
type Backend = typeof local
const cloudBackend: Backend = cloud
```

If one grows a function, or changes what it takes or returns, that line stops
compiling. A dual-backend setup usually rots because one side drifts quietly;
this one can't.

### Setting it up

1. Make a Supabase project.
2. Run `lib/supabase/journal.sql` in its SQL editor. This is the schema for the
   app as it stands — the older `schema.sql` belongs to the parked
   sticker/worker scaffolding and has no `entries` table at all.
3. Put the project URL, anon key and service role key in `.env.local`, along
   with `TOKEN_ENCRYPTION_KEY`.
4. Sign up. A profile and a first scrapbook are created for you by a trigger.
5. To bring an existing local journal across, `POST /api/migrate` while signed
   in. It copies rather than moves, keeps photo file names (a laid-out page
   refers to its pictures by name), and skips anything already carried over, so
   running it twice is safe. Your `.data/` folder is left exactly as it was.

### How it keeps journals apart

Two mechanisms, deliberately overlapping.

**Row level security** on every table: a person sees rows where
`owner = auth.uid()` and can write nothing else. Every query runs as the signed-in
person, so a forgotten `where owner = …` returns nothing rather than someone
else's diary.

**A composite foreign key**, which is the line I would point at in a review:

```sql
foreign key (scrapbook_id, owner) references scrapbooks (id, owner)
```

An entry may only sit in a scrapbook belonging to the same person. A mismatched
pair has nothing to reference, so the write fails in the database. Policies can
be misconfigured; this cannot.

Sharing is deliberately **not** an RLS policy. A policy like `using (is_public)`
would let anyone list every shared scrapbook; instead two `security definer`
functions answer only for a token you already hold, and only for a scrapbook
explicitly marked public.

### Connected accounts

`lib/connections.ts` splits the same way, and the hosted backing is stricter
than the local one in a specific way: **it refuses to store a refresh token
without `TOKEN_ENCRYPTION_KEY` set.** Locally an unencrypted token sits in a
file only you can read. In a shared database it would sit next to everyone
else's, so that save is refused rather than quietly done.

Without this split, two people on one deployment would share a single Spotify
connection — one person's recently-played appearing on another person's page.

### Differences worth knowing

- **Capture dates.** The local backing reads them out of a photo's EXIF with
  sharp; the hosted one stores whatever it was given, since the file goes
  straight to storage.
- **Sweeping.** `sweepOrphans` does nothing in the cloud: a picture belongs to a
  row and goes when the row does, so there is nothing to orphan.
- **Writes.** The local store rewrites a whole collection to change one thing,
  which is safe with one process and a lost update waiting to happen with two.
  The hosted one changes single rows.

### Sharing a scrapbook

A hosted scrapbook can be turned into a link, from the card at the bottom of
its page. Anyone holding that link can read it; nobody else can. There is no
password on it, so the card says exactly that rather than letting anyone assume
otherwise, and "Make a new link" mints a fresh token so every link handed out
so far stops working.

Two pieces make this safe to expose.

The **entries** come from `shared_scrapbook()` and `shared_entries()` —
`security definer` functions that answer only for a token you already hold, and
only while the scrapbook is still marked public. Sharing is deliberately not an
RLS policy: `using (is_public)` would let anyone list every shared scrapbook in
the database.

The **pictures** are the harder half. The storage bucket is private and a
visitor has no session, so the ordinary photo route cannot serve them —
a naive implementation shares a page where every image is broken. Instead
`/api/s/<token>/photo/<name>` asks the database whether that named picture
actually appears on a page in that shared scrapbook, and only then streams it
with the service key. Knowing a file name is not enough; the name has to be on
a shared page, under the right token. The renderer takes the address as a
prop, so the same components draw a private page and a shared one.

Sharing exists only in the hosted version — a local journal has nobody to share
with, so the card is absent and `/s/…` answers 404.

## Adding keys later

`.env.example` lists the credentials for the parts that are still parked:
Supabase accounts, the Spotify/Steam/YouTube importers under `app/api/auth/`,
and the sticker/sync workers in `workers/`. Every one of those values is
optional. Until real Supabase credentials are set, `/dashboard` redirects to the
journal and the sign-in screens explain what's missing — nothing crashes.

```bash
cp .env.example .env.local
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run workers    # background workers (needs REDIS_URL)
```
# scrapbook
