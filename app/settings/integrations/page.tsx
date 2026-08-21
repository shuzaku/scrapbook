import { connection } from 'next/server'
import { format } from 'date-fns'
import Shell from '@/components/journal/Shell'
import { Button } from '@/components/ui/button'
import { expectedRedirectUri } from '@/lib/google/config'
import { isMapsConfigured } from '@/lib/google/maps'
import { googleStatus } from '@/lib/google/tokens'
import { spotifyStatus } from '@/lib/spotify/tokens'
import { expectedRedirectUri as spotifyRedirectUri } from '@/lib/spotify/config'
import { steamStatus } from '@/lib/steam/connection'
import { stravaStatus } from '@/lib/strava/tokens'
import { isAiConfigured, suggestModel } from '@/lib/ai/config'
import { callbackDomain, expectedRedirectUri as stravaRedirectUri } from '@/lib/strava/config'

const MESSAGES: Record<string, { tone: 'good' | 'bad'; text: string }> = {
  connected: { tone: 'good', text: 'Google Photos connected.' },
  disconnected: { tone: 'good', text: 'Google Photos disconnected.' },
  denied: { tone: 'bad', text: 'You declined the Google consent screen.' },
  state_mismatch: {
    tone: 'bad',
    text: 'That sign-in didn’t match the request it started from — try again.',
  },
  no_code: { tone: 'bad', text: 'Google didn’t send an authorisation code back.' },
  exchange_failed: {
    tone: 'bad',
    text: 'Exchanging the code for a token failed — check the server log and your credentials.',
  },
  unconfigured: { tone: 'bad', text: 'No Google credentials are set.' },
}

const SPOTIFY_MESSAGES: Record<string, { tone: 'good' | 'bad'; text: string }> = {
  connected: { tone: 'good', text: 'Spotify connected.' },
  disconnected: { tone: 'good', text: 'Spotify disconnected.' },
  denied: { tone: 'bad', text: 'You declined the Spotify consent screen.' },
  state_mismatch: {
    tone: 'bad',
    text: 'That sign-in didn’t match the request it started from — try again.',
  },
  no_code: { tone: 'bad', text: 'Spotify didn’t send an authorisation code back.' },
  exchange_failed: {
    tone: 'bad',
    text: 'Exchanging the code for a token failed — check the server log and your credentials.',
  },
  unconfigured: { tone: 'bad', text: 'No Spotify credentials are set.' },
}

const STEAM_MESSAGES: Record<string, { tone: 'good' | 'bad'; text: string }> = {
  connected: { tone: 'good', text: 'Signed in through Steam.' },
  disconnected: { tone: 'good', text: 'Steam disconnected.' },
  denied: { tone: 'bad', text: 'You cancelled the Steam sign-in.' },
  unverified: {
    tone: 'bad',
    text: 'Steam did not confirm that sign-in — try again.',
  },
  failed: { tone: 'bad', text: 'Steam sign-in failed — check the server log.' },
  unconfigured: { tone: 'bad', text: 'No Steam API key is set.' },
}

const STRAVA_MESSAGES: Record<string, { tone: 'good' | 'bad'; text: string }> = {
  connected: { tone: 'good', text: 'Strava connected.' },
  disconnected: { tone: 'good', text: 'Strava disconnected.' },
  denied: { tone: 'bad', text: 'You declined the Strava consent screen.' },
  state_mismatch: {
    tone: 'bad',
    text: 'That sign-in didn\u2019t match the request it started from \u2014 try again.',
  },
  no_code: { tone: 'bad', text: 'Strava didn\u2019t send an authorisation code back.' },
  no_scope: {
    tone: 'bad',
    text: 'Strava was connected without permission to read activities \u2014 tick that box and try again.',
  },
  exchange_failed: {
    tone: 'bad',
    text: 'Exchanging the code for a token failed \u2014 check the server log and your credentials.',
  },
  unconfigured: { tone: 'bad', text: 'No Strava credentials are set.' },
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[13px] text-violet-200">
      {children}
    </code>
  )
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    google?: string
    spotify?: string
    steam?: string
    strava?: string
  }>
}) {
  await connection()
  const status = await googleStatus()
  const maps = isMapsConfigured()
  const spotify = await spotifyStatus()
  const steam = await steamStatus()
  const strava = await stravaStatus()
  const aiOn = isAiConfigured()
  const query = await searchParams
  const notice =
    MESSAGES[query.google ?? ''] ??
    SPOTIFY_MESSAGES[query.spotify ?? ''] ??
    STEAM_MESSAGES[query.steam ?? ''] ??
    STRAVA_MESSAGES[query.strava ?? '']

  return (
    <Shell crumb={{ href: '/', label: 'Shelf' }} action={<span className="text-sm text-white/40">Integrations</span>}>
      <h1 className="mb-2 text-2xl font-bold text-white">Integrations</h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-white/55">
        The journal works with no accounts at all. Connecting a service is optional, and only adds
        a way to get photos in.
      </p>

      {notice && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === 'good'
              ? 'border-green-500/40 bg-green-500/10 text-green-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>🖼</span> Google Photos
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
              Pick photos from your Google account and drop them straight onto a page. You choose
              the photos in Google’s own picker — this app only ever receives what you picked, never
              your whole library.
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              status.state === 'connected'
                ? 'bg-green-500/20 text-green-200'
                : status.state === 'disconnected'
                  ? 'bg-white/10 text-white/60'
                  : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {status.state === 'connected'
              ? 'Connected'
              : status.state === 'disconnected'
                ? 'Not connected'
                : 'Needs setup'}
          </span>
        </div>

        {status.state === 'connected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-sm text-white/70">
              {status.email ?? 'Connected account'}
              {status.connectedAt && (
                <span className="text-white/40">
                  {' '}
                  · since {format(new Date(status.connectedAt), 'd MMM yyyy')}
                </span>
              )}
            </p>
            {status.plaintext && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-amber-200/80">
                The refresh token is stored as plain text in{' '}
                <Code>.data/connections.json</Code>. Set <Code>TOKEN_ENCRYPTION_KEY</Code> to a
                32-byte hex string and reconnect to encrypt it at rest.
              </p>
            )}
            <form action="/api/integrations/google/disconnect" method="POST" className="mt-4">
              <Button type="submit" size="sm" variant="outline">
                Disconnect
              </Button>
            </form>
          </div>
        )}

        {status.state === 'disconnected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <a href="/api/integrations/google/start?returnTo=/settings/integrations">
              <Button size="sm">Connect Google Photos</Button>
            </a>
          </div>
        )}

        {status.state === 'unconfigured' && (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm text-white/60">
            <p>To switch this on, create an OAuth client in Google Cloud:</p>
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>
                Enable the <strong className="text-white/80">Photos Picker API</strong> in your
                Google Cloud project.
              </li>
              <li>
                Create an OAuth 2.0 <strong className="text-white/80">Web application</strong>{' '}
                client, with this redirect URI: <Code>{expectedRedirectUri()}</Code>
              </li>
              <li>
                On the consent screen, add the scope{' '}
                <Code>.../auth/photospicker.mediaitems.readonly</Code> and add yourself as a test
                user while the app is unverified.
              </li>
              <li>
                Put the credentials in <Code>.env.local</Code> and restart the dev server:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] text-white/70">
                  {`GOOGLE_CLIENT_ID=...\nGOOGLE_CLIENT_SECRET=...\nTOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)`}
                </pre>
              </li>
            </ol>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>📍</span> Google Maps
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
              Look up a shop, restaurant or landmark and stick it on a page — as a pin, a map
              cut-out, or a QR code that opens the place when scanned. Everything is fetched here
              on the server and stored as plain images, so your key never reaches the browser and a
              finished page still works with no Google access at all.
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              maps ? 'bg-green-500/20 text-green-200' : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {maps ? 'Ready' : 'Needs setup'}
          </span>
        </div>

        {maps ? (
          <p className="mt-6 border-t border-white/10 pt-5 text-sm text-white/60">
            A key is set. Look for the <strong className="text-white/80">Places</strong> tab in the
            page editor.
          </p>
        ) : (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm text-white/60">
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>
                In the same Google Cloud project, enable the{' '}
                <strong className="text-white/80">Maps Static API</strong> (for map cut-outs) and{' '}
                <strong className="text-white/80">Places API (New)</strong> (to search by name).
              </li>
              <li>
                Google requires a <strong className="text-white/80">billing account</strong> on the
                project for Maps, even inside the free monthly allowance.
              </li>
              <li>
                Create an <strong className="text-white/80">API key</strong> under Credentials, and
                restrict it to the Maps Static API.
              </li>
              <li>
                Add it to <Code>.env.local</Code> and restart:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] text-white/70">
                  {`GOOGLE_MAPS_API_KEY=...`}
                </pre>
              </li>
            </ol>
            <p className="text-xs leading-relaxed text-white/40">
              This is a plain API key, not the OAuth client above — the two are separate.
            </p>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="inline-block h-3 w-3 rounded-full bg-[#1DB954]" /> Spotify
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
              Adds your recently played tracks to the Music tab. Optional: searching for a song by
              name already works without it, so this only adds the convenience of picking from what
              you actually listened to. Only your recent plays are read.
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              spotify.state === 'connected'
                ? 'bg-green-500/20 text-green-200'
                : spotify.state === 'disconnected'
                  ? 'bg-white/10 text-white/60'
                  : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {spotify.state === 'connected'
              ? 'Connected'
              : spotify.state === 'disconnected'
                ? 'Not connected'
                : 'Needs setup'}
          </span>
        </div>

        {spotify.state === 'connected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-sm text-white/70">
              {spotify.label ?? 'Connected account'}
              {spotify.connectedAt && (
                <span className="text-white/40">
                  {' '}
                  · since {format(new Date(spotify.connectedAt), 'd MMM yyyy')}
                </span>
              )}
            </p>
            {spotify.plaintext && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-amber-200/80">
                The refresh token is stored as plain text. Set <Code>TOKEN_ENCRYPTION_KEY</Code> and
                reconnect to encrypt it at rest.
              </p>
            )}
            <form action="/api/integrations/spotify/disconnect" method="POST" className="mt-4">
              <Button type="submit" size="sm" variant="outline">
                Disconnect
              </Button>
            </form>
          </div>
        )}

        {spotify.state === 'disconnected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <a href="/api/integrations/spotify/start?returnTo=/settings/integrations">
              <Button size="sm">Connect Spotify</Button>
            </a>
          </div>
        )}

        {spotify.state === 'unconfigured' && (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm text-white/60">
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>
                Create an app at <strong className="text-white/80">developer.spotify.com</strong>{' '}
                (Dashboard → Create app).
              </li>
              <li>
                Add this redirect URI: <Code>{spotifyRedirectUri()}</Code>
                <span className="mt-1 block text-xs leading-relaxed text-white/40">
                  It has to be <Code>127.0.0.1</Code>, not <Code>localhost</Code> — Spotify stopped
                  accepting the localhost alias in November 2025. Connecting will move you to
                  127.0.0.1 automatically.
                </span>
              </li>
              <li>
                The account that owns the app needs{' '}
                <strong className="text-white/80">Spotify Premium</strong> — the Web API refuses
                every request otherwise.
              </li>
              <li>
                While the app is in development mode it only works for accounts you add under{' '}
                <strong className="text-white/80">Users and Access</strong> — add your own.
              </li>
              <li>
                Put the credentials in <Code>.env.local</Code> and restart:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] text-white/70">
                  {`SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...`}
                </pre>
              </li>
            </ol>
            <p className="text-xs leading-relaxed text-white/40">
              Only the <Code>user-read-recently-played</Code> scope is requested.
            </p>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>🎮</span> Steam
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
              Adds the games you have played in the last fortnight, and the achievements you
              unlocked in them. Optional: searching the store for a game already works without it,
              so this only adds your own library.
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              steam.state === 'connected'
                ? 'bg-green-500/20 text-green-200'
                : steam.state === 'disconnected'
                  ? 'bg-white/10 text-white/60'
                  : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {steam.state === 'connected'
              ? 'Connected'
              : steam.state === 'disconnected'
                ? 'Not signed in'
                : 'Needs setup'}
          </span>
        </div>

        {steam.state === 'connected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-sm text-white/70">
              {steam.label ?? 'Signed in'}
              {steam.connectedAt && (
                <span className="text-white/40">
                  {' '}
                  · since {format(new Date(steam.connectedAt), 'd MMM yyyy')}
                </span>
              )}
            </p>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/40">
              Steam has no tokens to store — only your SteamID is kept, and the app calls Steam
              with its own key.
            </p>
            <form action="/api/integrations/steam/disconnect" method="POST" className="mt-4">
              <Button type="submit" size="sm" variant="outline">
                Disconnect
              </Button>
            </form>
          </div>
        )}

        {steam.state === 'disconnected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <a href="/api/integrations/steam/start?returnTo=/settings/integrations">
              <Button size="sm">Sign in through Steam</Button>
            </a>
          </div>
        )}

        {steam.state === 'unconfigured' && (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm text-white/60">
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>
                Get a key at <Code>steamcommunity.com/dev/apikey</Code>. Steam only issues one to a
                non-limited account — one that has spent at least $5 in the store.
              </li>
              <li>
                Set your profile’s <strong className="text-white/80">Game details</strong> to
                Public, or Steam returns nothing rather than an error.
              </li>
              <li>
                Put it in <Code>.env.local</Code> and restart:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] text-white/70">
                  {`STEAM_API_KEY=...`}
                </pre>
              </li>
            </ol>
            <p className="text-xs leading-relaxed text-white/40">
              Steam signs you in with OpenID rather than OAuth, so there is no consent screen and
              nothing for the app to store beyond your SteamID.
            </p>
          </div>
        )}
      </section>


      <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>🏃</span> Strava
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
              Puts your runs and rides on a page \u2014 the route drawn from the ride itself, with
              the distance, time and climb. Nothing is ever posted back.
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              strava.state === 'connected'
                ? 'bg-green-500/20 text-green-200'
                : strava.state === 'disconnected'
                  ? 'bg-white/10 text-white/60'
                  : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {strava.state === 'connected'
              ? 'Connected'
              : strava.state === 'disconnected'
                ? 'Not connected'
                : 'Needs setup'}
          </span>
        </div>

        {strava.state === 'connected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-sm text-white/70">
              {strava.label ?? 'Connected athlete'}
              {strava.connectedAt && (
                <span className="text-white/40">
                  {' '}
                  \u00b7 since {format(new Date(strava.connectedAt), 'd MMM yyyy')}
                </span>
              )}
            </p>
            {strava.plaintext && (
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-amber-200/80">
                The refresh token is stored as plain text. Set <Code>TOKEN_ENCRYPTION_KEY</Code> to
                encrypt it at rest.
              </p>
            )}
            <form action="/api/integrations/strava/disconnect" method="POST" className="mt-4">
              <Button type="submit" size="sm" variant="outline">
                Disconnect
              </Button>
            </form>
          </div>
        )}

        {strava.state === 'disconnected' && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <a href="/api/integrations/strava/start?returnTo=/settings/integrations">
              <Button size="sm">Connect Strava</Button>
            </a>
          </div>
        )}

        {strava.state === 'unconfigured' && (
          <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm text-white/60">
            <p className="text-xs leading-relaxed text-white/45">
              The easiest of these to set up: registering is free and instant, with no membership
              fee, no approval queue and no subscription requirements.
            </p>
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>
                Make an app at <Code>strava.com/settings/api</Code>.
              </li>
              <li>
                For <strong className="text-white/80">Authorization Callback Domain</strong> put
                just the domain, with no scheme or path: <Code>{callbackDomain()}</Code>
              </li>
              <li>
                Copy the Client ID and Secret into <Code>.env.local</Code> and restart:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] text-white/70">
                  {`STRAVA_CLIENT_ID=...\nSTRAVA_CLIENT_SECRET=...`}
                </pre>
              </li>
              <li>
                When Strava asks, leave{' '}
                <strong className="text-white/80">View data about your activities</strong> ticked
                \u2014 without it there is nothing to show.
              </li>
            </ol>
            <p className="text-xs leading-relaxed text-white/40">
              The app will send you to <Code>{stravaRedirectUri()}</Code>, which is why only the
              domain goes in the dashboard.
            </p>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-violet-400/25 bg-violet-500/[0.07] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span>💡</span> Suggestions
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/55">
              Claude reads an entry and suggests what else might go on the page \u2014 the weather
              that day, the restaurant you mentioned, the film you described but never named. Each
              suggestion opens the tab that can fetch it.
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              aiOn ? 'bg-green-500/20 text-green-200' : 'bg-amber-500/15 text-amber-200'
            }`}
          >
            {aiOn ? 'On' : 'Needs setup'}
          </span>
        </div>

        <div className="mt-6 space-y-4 border-t border-white/10 pt-5 text-sm text-white/60">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
            <strong>This is the only part of the journal that sends anything anywhere.</strong>{' '}
            Everything else \u2014 photos, covers, routes \u2014 is downloaded and kept on this
            machine. Asking for suggestions sends that entry&rsquo;s words, its photo captions and
            the list of what is already on the page to Anthropic to be read. Nothing is sent unless
            you press the button, and no image is ever sent.
          </p>

          {aiOn ? (
            <p className="text-xs leading-relaxed text-white/45">
              Using <Code>{suggestModel()}</Code>. Set <Code>ANTHROPIC_MODEL</Code> to use a
              different one.
            </p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>
                Make a key at <Code>console.anthropic.com</Code>.
              </li>
              <li>
                Put it in <Code>.env.local</Code> and restart:
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] text-white/70">
                  {`ANTHROPIC_API_KEY=sk-ant-...`}
                </pre>
              </li>
              <li>
                Open any entry&rsquo;s page editor and look under{' '}
                <strong className="text-white/80">Ideas</strong>.
              </li>
            </ol>
          )}

          <p className="text-xs leading-relaxed text-white/40">
            Suggestions are billed to your Anthropic account, per press. An entry is a few hundred
            words, so each one is small \u2014 but it is not free, and it is the only thing here
            that costs anything to run.
          </p>
        </div>
      </section>
    </Shell>
  )
}
