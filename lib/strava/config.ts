/**
 * Strava settings, all optional — without them the Workouts tab explains how
 * to switch it on and the rest of the journal is unaffected.
 *
 * Strava is the friendliest of the account-based services here: registering an
 * app is free and instant, with no membership fee (unlike Apple Music), no
 * approval queue (unlike Instagram), and no ownership requirements (unlike
 * Spotify's Premium rule).
 */

export const AUTH_ENDPOINT = 'https://www.strava.com/oauth/authorize'
export const TOKEN_ENDPOINT = 'https://www.strava.com/oauth/token'
export const API = 'https://www.strava.com/api/v3'

/**
 * Everything you've recorded, including activities you've marked private.
 * `activity:read` alone would silently skip those, which is worse than not
 * asking — a missing run looks like a bug.
 */
export const SCOPES = 'activity:read_all'

export interface StravaConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export function callbackPath(): string {
  return '/api/integrations/strava/callback'
}

/**
 * Strava is unusually relaxed here: it registers a callback *domain*, not a
 * full address, and plain http on localhost is accepted. So the derived URI
 * needs no special handling.
 */
export function expectedRedirectUri(): string {
  return process.env.STRAVA_REDIRECT_URI || `${appUrl()}${callbackPath()}`
}

/** What goes in the dashboard's "Authorization Callback Domain" box. */
export function callbackDomain(): string {
  try {
    return new URL(expectedRedirectUri()).hostname
  } catch {
    return 'localhost'
  }
}

export function stravaConfig(): StravaConfig | null {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  if (clientId.startsWith('your_') || clientSecret.startsWith('your_')) return null

  return { clientId, clientSecret, redirectUri: expectedRedirectUri() }
}

export function isStravaConfigured(): boolean {
  return stravaConfig() !== null
}

/**
 * The origin the browser actually used.
 *
 * Next's `request.url` reports the dev server's own origin rather than the
 * host that was asked for, so a redirect built from it can point at the wrong
 * place — or at itself.
 */
export function browserOrigin(request: Request): string {
  const host = request.headers.get('host')
  if (!host) return appUrl()
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}
