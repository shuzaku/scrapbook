import { NextResponse } from 'next/server'
import { SteamError, unlockedAchievements } from '@/lib/steam/api'
import { connectedSteamId } from '@/lib/steam/connection'

/** What you've unlocked in one game, newest first. */
export async function GET(request: Request) {
  const steamId = await connectedSteamId()
  if (!steamId) {
    return NextResponse.json({ error: 'Not signed in through Steam' }, { status: 401 })
  }

  const appId = Number(new URL(request.url).searchParams.get('appid'))
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: 'Which game?' }, { status: 400 })
  }

  try {
    const achievements = await unlockedAchievements(steamId, appId)
    return NextResponse.json({
      achievements,
      hint:
        achievements.length === 0
          ? 'Nothing unlocked here — or this game has no achievements.'
          : undefined,
    })
  } catch (err) {
    console.error('[steam] achievements failed', err)
    const message = err instanceof SteamError ? err.message : 'Could not read achievements'
    const status = err instanceof SteamError && err.status === 403 ? 403 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
