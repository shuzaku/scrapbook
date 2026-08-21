import { NextResponse } from 'next/server'
import { SteamError, gameScreenshots } from '@/lib/steam/api'

/** A game's official screenshots. Public — no key, no sign-in. */
export async function GET(request: Request) {
  const appId = Number(new URL(request.url).searchParams.get('appid'))
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Which game?' }, { status: 400 })
  }

  try {
    return NextResponse.json({ screenshots: await gameScreenshots(appId) })
  } catch (err) {
    console.error('[steam] screenshots failed', err)
    const message = err instanceof SteamError ? err.message : 'Could not read screenshots'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
