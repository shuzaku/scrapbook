import { NextResponse, type NextRequest } from 'next/server'
import { verify } from '@/lib/steam/openid'
import { playerName } from '@/lib/steam/api'
import { saveSteamConnection } from '@/lib/steam/connection'

/** Where Steam sends the browser back, with an identity to check. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const host = request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`

  const requested = params.get('returnTo') ?? '/settings/integrations'
  const returnTo =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/settings/integrations'

  const done = (query: string) => NextResponse.redirect(new URL(`${returnTo}${query}`, origin))

  if (params.get('openid.mode') === 'cancel') return done('?steam=denied')

  try {
    // Checked with Steam rather than trusted: the claimed id is just a query
    // parameter until Steam confirms it signed it.
    const steamId = await verify(params)
    if (!steamId) return done('?steam=unverified')

    await saveSteamConnection(steamId, await playerName(steamId))
    return done('?steam=connected')
  } catch (err) {
    console.error('[steam] sign-in failed', err)
    return done('?steam=failed')
  }
}
