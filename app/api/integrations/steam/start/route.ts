import { NextResponse, type NextRequest } from 'next/server'
import { authUrl } from '@/lib/steam/openid'
import { isSteamConfigured } from '@/lib/steam/config'

/** Sends the person to Steam to sign in. */
export async function GET(request: NextRequest) {
  if (!isSteamConfigured()) {
    return NextResponse.redirect(new URL('/settings/integrations?steam=unconfigured', request.url))
  }

  const host = request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`

  const requested = request.nextUrl.searchParams.get('returnTo') ?? '/settings/integrations'
  // Only ever come back to a path on this app.
  const returnTo =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/settings/integrations'

  // Steam sends the identity to return_to, so the destination carries where to
  // go afterwards rather than a cookie.
  const back = new URL('/api/integrations/steam/callback', origin)
  back.searchParams.set('returnTo', returnTo)

  return NextResponse.redirect(authUrl(back.toString(), origin))
}
