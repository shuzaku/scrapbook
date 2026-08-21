/**
 * The Google connection, on top of the shared account store.
 *
 * See lib/connections.ts for where it's kept and how it's protected.
 */
import {
  clearConnection,
  connectionStatus,
  liveAccessToken,
  refreshTokenFor,
  saveConnection as store,
  updateAccessToken,
  type ConnectionStatus,
} from '@/lib/connections'
import { TOKEN_ENDPOINT, googleConfig } from './config'

export type GoogleStatus = ConnectionStatus & { email?: string | null }

export async function saveConnection(tokens: {
  refreshToken: string
  accessToken: string
  expiresIn: number
  email: string | null
}): Promise<void> {
  await store('google', { ...tokens, label: tokens.email })
}

export async function clearGoogleConnection(): Promise<void> {
  await clearConnection('google')
}

export { clearGoogleConnection as clearConnection }

export async function googleStatus(): Promise<GoogleStatus> {
  const status = await connectionStatus('google', googleConfig() !== null)
  return { ...status, email: status.label }
}

/**
 * A usable access token, refreshing it first if it has expired or is about to.
 * Returns null when the app isn't connected.
 */
export async function getAccessToken(): Promise<string | null> {
  const config = googleConfig()
  if (!config) return null

  const live = await liveAccessToken('google')
  if (live) return live

  const refreshToken = await refreshTokenFor('google')
  if (!refreshToken) return null

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    // A revoked or expired grant can't be recovered from — drop it so the UI
    // asks the person to reconnect instead of failing forever.
    if (res.status === 400 || res.status === 401) await clearConnection('google')
    return null
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  await updateAccessToken('google', data.access_token, data.expires_in)
  return data.access_token
}
