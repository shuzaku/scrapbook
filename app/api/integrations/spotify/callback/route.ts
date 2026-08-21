import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_ENDPOINT, basicAuth, browserOrigin, spotifyConfig } from '@/lib/spotify/config'
import { saveSpotifyConnection } from '@/lib/spotify/tokens'
import { currentUserName } from '@/lib/spotify/api'

/** Where Spotify sends the person back. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const returnTo = request.cookies.get('spotify_oauth_return')?.value ?? '/settings/integrations'

  // Keep them on whichever origin they came in on — the handshake happens on
  // 127.0.0.1, and bouncing to another host mid-flow is just confusing.
  const origin = browserOrigin(request)

  const done = (query: string) => {
    const response = NextResponse.redirect(new URL(`${returnTo}${query}`, origin))
    response.cookies.delete('spotify_oauth_state')
    response.cookies.delete('spotify_oauth_return')
    return response
  }

  if (params.get('error')) return done('?spotify=denied')

  const state = params.get('state')
  const expected = request.cookies.get('spotify_oauth_state')?.value
  if (!state || !expected || state !== expected) return done('?spotify=state_mismatch')

  const code = params.get('code')
  const config = spotifyConfig()
  if (!code) return done('?spotify=no_code')
  if (!config) return done('?spotify=unconfigured')

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth(config)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
    })

    if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${await res.text()}`)

    const data = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }
    if (!data.refresh_token) throw new Error('Spotify returned no refresh token')

    await saveSpotifyConnection({
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      label: await currentUserName(data.access_token),
    })
    return done('?spotify=connected')
  } catch (err) {
    console.error('[spotify] token exchange failed', err)
    return done('?spotify=exchange_failed')
  }
}
