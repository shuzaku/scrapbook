/** The OAuth handshake with Google. */
import { AUTH_ENDPOINT, PICKER_SCOPE, REVOKE_ENDPOINT, TOKEN_ENDPOINT, googleConfig } from './config'

export function authorizeUrl(state: string): string | null {
  const config = googleConfig()
  if (!config) return null

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: PICKER_SCOPE,
    // Offline + consent so we actually receive a refresh token, including on
    // a repeat authorisation where Google would otherwise omit it.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_ENDPOINT}?${params}`
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  idToken?: string
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const config = googleConfig()
  if (!config) throw new Error('Google is not configured')

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    id_token?: string
  }

  if (!data.refresh_token) {
    throw new Error('Google did not return a refresh token — revoke the app’s access and retry')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    idToken: data.id_token,
  }
}

/**
 * Pulls the account's email out of the id_token for display. The token came
 * straight from Google's token endpoint over TLS, and it's only ever used as a
 * label, so the payload is read without verifying the signature.
 */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null
  try {
    const payload = idToken.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    const claims = JSON.parse(json) as { email?: string }
    return claims.email ?? null
  } catch {
    return null
  }
}

export async function revoke(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {
    // Best effort: local disconnect happens either way.
  })
}
