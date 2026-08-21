/** The Strava connection, on top of the shared account store. */
import {
  clearConnection,
  connectionStatus,
  liveAccessToken,
  refreshTokenFor,
  saveConnection as store,
  updateAccessToken,
  type ConnectionStatus,
} from '@/lib/connections'
import { TOKEN_ENDPOINT, stravaConfig } from './config'

export async function saveStravaConnection(tokens: {
  refreshToken: string
  accessToken: string
  expiresIn: number
  label: string | null
}): Promise<void> {
  await store('strava', tokens)
}

export async function clearStravaConnection(): Promise<void> {
  await clearConnection('strava')
}

export async function stravaStatus(): Promise<ConnectionStatus> {
  return connectionStatus('strava', stravaConfig() !== null)
}

/**
 * A usable access token, refreshed if the old one has run out.
 *
 * Strava's access tokens last six hours — far shorter than Spotify's — so this
 * refresh path runs often, and Strava hands back a **new refresh token** each
 * time. Storing it is not optional: keep the old one and the next refresh
 * fails.
 */
export async function getStravaToken(): Promise<string | null> {
  const config = stravaConfig()
  if (!config) return null

  const live = await liveAccessToken('strava')
  if (live) return live

  const refreshToken = await refreshTokenFor('strava')
  if (!refreshToken) return null

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    // A refusal means the authorisation was revoked from Strava's side, so
    // there is nothing to retry with — drop it and ask for a reconnect.
    if (res.status === 400 || res.status === 401) await clearConnection('strava')
    return null
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: unknown
    expires_at?: unknown
    refresh_token?: unknown
  } | null

  if (typeof data?.access_token !== 'string') return null

  // Strava gives an absolute expiry in epoch seconds, where the store wants a
  // duration.
  const expiresIn =
    typeof data.expires_at === 'number'
      ? Math.max(60, data.expires_at - Math.floor(Date.now() / 1000))
      : 6 * 60 * 60

  await updateAccessToken(
    'strava',
    data.access_token,
    expiresIn,
    typeof data.refresh_token === 'string' ? data.refresh_token : undefined
  )

  return data.access_token
}
