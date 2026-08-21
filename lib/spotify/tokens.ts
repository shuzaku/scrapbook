/** The Spotify connection, on top of the shared account store. */
import {
  clearConnection,
  connectionStatus,
  liveAccessToken,
  refreshTokenFor,
  saveConnection as store,
  updateAccessToken,
  type ConnectionStatus,
} from '@/lib/connections'
import { TOKEN_ENDPOINT, basicAuth, spotifyConfig } from './config'

export async function saveSpotifyConnection(tokens: {
  refreshToken: string
  accessToken: string
  expiresIn: number
  label: string | null
}): Promise<void> {
  await store('spotify', tokens)
}

export async function clearSpotifyConnection(): Promise<void> {
  await clearConnection('spotify')
}

export async function spotifyStatus(): Promise<ConnectionStatus> {
  return connectionStatus('spotify', spotifyConfig() !== null)
}

/** A usable access token, refreshed if the old one has run out. */
export async function getSpotifyToken(): Promise<string | null> {
  const config = spotifyConfig()
  if (!config) return null

  const live = await liveAccessToken('spotify')
  if (live) return live

  const refreshToken = await refreshTokenFor('spotify')
  if (!refreshToken) return null

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth(config)}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  if (!res.ok) {
    // Spotify refresh tokens don't expire on a timer, so a refusal here means
    // access was revoked — drop it and ask for a reconnect.
    if (res.status === 400 || res.status === 401) await clearConnection('spotify')
    return null
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    refresh_token?: string
  }
  await updateAccessToken('spotify', data.access_token, data.expires_in, data.refresh_token)
  return data.access_token
}
