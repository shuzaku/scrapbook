import { NextResponse } from 'next/server'
import { SteamError, recentlyPlayed } from '@/lib/steam/api'
import { connectedSteamId } from '@/lib/steam/connection'

/** Your last two weeks of playing, for the Games tab. */
export async function GET() {
  const steamId = await connectedSteamId()
  if (!steamId) {
    return NextResponse.json({ error: 'Not signed in through Steam' }, { status: 401 })
  }

  try {
    const games = await recentlyPlayed(steamId)
    return NextResponse.json({
      games,
      // An empty list is usually privacy rather than idleness, and saying so
      // saves a lot of confused poking.
      hint:
        games.length === 0
          ? 'Nothing came back. Steam hides this unless your profile’s game details are set to public.'
          : undefined,
    })
  } catch (err) {
    console.error('[steam] recently played failed', err)
    const message = err instanceof SteamError ? err.message : 'Could not read your recent games'
    const status = err instanceof SteamError && err.status === 403 ? 403 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
