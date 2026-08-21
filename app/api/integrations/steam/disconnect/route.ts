import { NextResponse, type NextRequest } from 'next/server'
import { clearSteamConnection } from '@/lib/steam/connection'

/** Forgets the SteamID. Nothing is revoked because nothing was granted. */
export async function POST(request: NextRequest) {
  await clearSteamConnection()
  const host = request.headers.get('host') ?? ''
  const proto = request.headers.get('x-forwarded-proto') ?? 'http'
  return NextResponse.redirect(
    new URL('/settings/integrations?steam=disconnected', `${proto}://${host}`),
    { status: 303 }
  )
}
