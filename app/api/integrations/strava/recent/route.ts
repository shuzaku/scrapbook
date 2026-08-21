import { NextResponse } from 'next/server'
import { StravaError, recentWorkouts } from '@/lib/strava/api'
import { getStravaToken } from '@/lib/strava/tokens'

/** Your recent activities, for the Workouts tab. */
export async function GET() {
  const token = await getStravaToken()
  if (!token) {
    return NextResponse.json({ error: 'Not connected to Strava' }, { status: 401 })
  }

  try {
    return NextResponse.json({ workouts: await recentWorkouts(token) })
  } catch (err) {
    console.error('[strava] reading activities failed', err)
    const known = err instanceof StravaError
    return NextResponse.json(
      { error: known ? err.message : 'Could not read your activities' },
      { status: known ? err.status : 502 }
    )
  }
}
