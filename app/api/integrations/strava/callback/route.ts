import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_ENDPOINT, browserOrigin, stravaConfig } from '@/lib/strava/config'
import { athleteName } from '@/lib/strava/api'
import { saveStravaConnection } from '@/lib/strava/tokens'

/** Where Strava sends you back, with a code to trade for tokens. */
export async function GET(request: NextRequest) {
  const origin = browserOrigin(request)
  const params = request.nextUrl.searchParams

  const cookies = request.cookies
  const returnTo = cookies.get('strava_oauth_return')?.value ?? '/settings/integrations'
  const expected = cookies.get('strava_oauth_state')?.value
  const done = (outcome: string) => {
    const response = NextResponse.redirect(`${origin}${returnTo}?strava=${outcome}`)
    response.cookies.delete('strava_oauth_state')
    response.cookies.delete('strava_oauth_return')
    return response
  }

  if (params.get('error')) return done('denied')

  const state = params.get('state')
  if (!expected || !state || state !== expected) return done('state_mismatch')

  const code = params.get('code')
  if (!code) return done('no_code')

  // Strava lists the scopes actually granted; without read access there is
  // nothing to show, and saying so beats an empty list later.
  const granted = params.get('scope') ?? ''
  if (!granted.includes('activity:read')) return done('no_scope')

  const config = stravaConfig()
  if (!config) return done('unconfigured')

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!res.ok) throw new Error(`token exchange failed (${res.status})`)

    const data = (await res.json()) as {
      access_token?: unknown
      refresh_token?: unknown
      expires_at?: unknown
      athlete?: { firstname?: unknown; lastname?: unknown } | null
    }

    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
      throw new Error('token exchange returned no tokens')
    }

    const expiresIn =
      typeof data.expires_at === 'number'
        ? Math.max(60, data.expires_at - Math.floor(Date.now() / 1000))
        : 6 * 60 * 60

    // The athlete comes back with the tokens, so the name costs nothing here.
    const fromToken = [data.athlete?.firstname, data.athlete?.lastname]
      .filter((part) => typeof part === 'string')
      .join(' ')
      .trim()

    await saveStravaConnection({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn,
      label: fromToken || (await athleteName(data.access_token)),
    })

    return done('connected')
  } catch (err) {
    console.error('[strava] connecting failed', err)
    return done('exchange_failed')
  }
}
