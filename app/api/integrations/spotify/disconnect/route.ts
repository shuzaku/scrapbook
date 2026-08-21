import { NextResponse, type NextRequest } from 'next/server'
import { browserOrigin } from '@/lib/spotify/config'
import { clearSpotifyConnection } from '@/lib/spotify/tokens'

/** Drops the stored tokens. Revoking access itself is done in your Spotify account. */
export async function POST(request: NextRequest) {
  await clearSpotifyConnection()
  return NextResponse.redirect(
    new URL('/settings/integrations?spotify=disconnected', browserOrigin(request)),
    { status: 303 }
  )
}
