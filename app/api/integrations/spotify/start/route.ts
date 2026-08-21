import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_ENDPOINT, SCOPES, spotifyConfig } from '@/lib/spotify/config'

/** Sends the person to Spotify's consent screen. */
export async function GET(request: NextRequest) {
  const config = spotifyConfig()
  if (!config) {
    return NextResponse.redirect(new URL('/settings/integrations?spotify=unconfigured', request.url))
  }

  // The whole handshake has to happen on 127.0.0.1: that's the only loopback
  // form Spotify accepts, and the state cookie set here must be readable by
  // the callback, which cookies scope per origin. Move across first if needed.
  //
  // The Host header is what the browser actually asked for — `nextUrl` reports
  // the dev server's own origin, which made this redirect to itself forever.
  const host = request.headers.get('host') ?? ''
  const [hostname, port] = host.split(':')

  if (hostname.toLowerCase() === 'localhost') {
    const onLoopback = `http://127.0.0.1${port ? `:${port}` : ''}${request.nextUrl.pathname}${request.nextUrl.search}`
    return NextResponse.redirect(onLoopback)
  }

  const state = randomUUID()
  const requested = request.nextUrl.searchParams.get('returnTo') ?? '/settings/integrations'
  // Only ever return to a path on this app.
  const returnTo =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/settings/integrations'

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state,
  })

  const response = NextResponse.redirect(`${AUTH_ENDPOINT}?${params}`)
  const secure = request.nextUrl.protocol === 'https:'
  const options = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 600 }
  response.cookies.set('spotify_oauth_state', state, options)
  response.cookies.set('spotify_oauth_return', returnTo, options)
  return response
}
