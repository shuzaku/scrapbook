import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_ENDPOINT, SCOPES, browserOrigin, stravaConfig } from '@/lib/strava/config'

/** Sends the person to Strava's consent screen. */
export async function GET(request: NextRequest) {
  const origin = browserOrigin(request)
  const config = stravaConfig()

  if (!config) {
    return NextResponse.redirect(`${origin}/settings/integrations?strava=unconfigured`)
  }

  const state = randomUUID()
  const requested = request.nextUrl.searchParams.get('returnTo') ?? '/settings/integrations'
  const returnTo =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/settings/integrations'

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    // Ask every time rather than silently reusing a narrower old grant.
    approval_prompt: 'auto',
    state,
  })

  const response = NextResponse.redirect(`${AUTH_ENDPOINT}?${params}`)
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: origin.startsWith('https://'),
    path: '/',
    maxAge: 600,
  }
  response.cookies.set('strava_oauth_state', state, options)
  response.cookies.set('strava_oauth_return', returnTo, options)
  return response
}
