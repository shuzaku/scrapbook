/**
 * Spotify settings, all optional — without them the Music tab just explains
 * how to switch it on and the rest of the journal is unaffected.
 */

export const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'
export const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
export const API = 'https://api.spotify.com/v1'

/** Only what's needed to read what you've listened to. */
export const SCOPES = 'user-read-recently-played'

export interface SpotifyConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export function callbackPath(): string {
  return '/api/integrations/spotify/callback'
}

/**
 * Spotify dropped support for the `localhost` alias in November 2025: a
 * redirect URI must be HTTPS, or a loopback **IP literal**. So the derived URI
 * always uses 127.0.0.1, even when the app is otherwise reached on localhost.
 *
 * Any SPOTIFY_REDIRECT_URI left over from the parked importer is ignored — it
 * points at a different path and would send you to register the wrong thing.
 */
export function expectedRedirectUri(): string {
  return `${loopbackSafe(appUrl())}${callbackPath()}`
}

/** Swaps the localhost alias for the IP literal Spotify insists on. */
export function loopbackSafe(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost') parsed.hostname = '127.0.0.1'
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
  }
}

export function spotifyConfig(): SpotifyConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  if (clientId.startsWith('your_') || clientSecret.startsWith('your_')) return null

  return { clientId, clientSecret, redirectUri: expectedRedirectUri() }
}

export function isSpotifyConfigured(): boolean {
  return spotifyConfig() !== null
}

/**
 * The origin the browser actually used.
 *
 * Next's `request.url` / `nextUrl` report the dev server's own origin, not the
 * host that was requested — so anything building a redirect from them can send
 * you to the wrong origin, or to itself.
 */
export function browserOrigin(request: Request): string {
  const host = request.headers.get('host')
  if (!host) return appUrl()
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/** Spotify authenticates the token endpoint with HTTP Basic. */
export function basicAuth(config: SpotifyConfig): string {
  return Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
}
