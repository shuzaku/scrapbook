import { NextResponse, type NextRequest } from 'next/server'
import { browserOrigin } from '@/lib/strava/config'
import { clearStravaConnection } from '@/lib/strava/tokens'

/** Forgets the connection. Strava keeps its own record until revoked there. */
export async function POST(request: NextRequest) {
  await clearStravaConnection()
  return NextResponse.redirect(`${browserOrigin(request)}/settings/integrations?strava=disconnected`, {
    status: 303,
  })
}
