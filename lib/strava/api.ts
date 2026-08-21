/**
 * Reading what you've been doing, from Strava.
 *
 * Only the summary list is used: it already carries the route, so a workout
 * can go on a page without a second request per activity.
 */
import { API } from './config'
import { isPolyline } from './polyline'

export interface Workout {
  id: number
  name: string
  /** Run, Ride, Walk, Hike, Swim, and so on. */
  sport: string
  /** Metres. */
  distance: number
  /** Seconds spent moving, which is what pace is reckoned from. */
  movingTime: number
  elapsedTime: number
  /** Metres climbed. */
  elevation: number
  /** ISO wall-clock in the athlete's own timezone, no offset. */
  startedAt: string | null
  /** The route, still encoded; drawn at render time. */
  polyline: string
  averageHeartrate: number | null
  kudos: number
  url: string
}

export class StravaError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'StravaError'
  }
}

interface RawActivity {
  id?: unknown
  name?: unknown
  sport_type?: unknown
  type?: unknown
  distance?: unknown
  moving_time?: unknown
  elapsed_time?: unknown
  total_elevation_gain?: unknown
  start_date_local?: unknown
  average_heartrate?: unknown
  kudos_count?: unknown
  map?: { summary_polyline?: unknown } | null
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Strava's local start time comes as "2024-04-05T07:12:50Z" where the Z is a
 * lie — it's already the athlete's local time. Dropping it keeps the reading
 * honest, the same way EXIF timestamps are handled.
 */
function wallClock(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const found = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  return found ? found[0] : null
}

export async function recentWorkouts(token: string, limit = 20): Promise<Workout[]> {
  const params = new URLSearchParams({ per_page: String(Math.min(limit, 100)) })

  let res: Response
  try {
    res = await fetch(`${API}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new StravaError('Could not reach Strava', 502)
  }

  if (res.status === 401) throw new StravaError('Strava rejected the connection', 401)
  if (res.status === 429) {
    throw new StravaError('Strava is rate limiting — try again in a few minutes', 429)
  }
  if (!res.ok) throw new StravaError(`Strava answered ${res.status}`, 502)

  const body = await res.json().catch(() => null)
  const list = Array.isArray(body) ? (body as RawActivity[]) : []

  return list.flatMap((activity) => {
    const id = typeof activity.id === 'number' ? activity.id : null
    if (id === null) return []

    const polyline = activity.map?.summary_polyline
    const sport =
      typeof activity.sport_type === 'string'
        ? activity.sport_type
        : typeof activity.type === 'string'
          ? activity.type
          : 'Workout'

    return [
      {
        id,
        name: typeof activity.name === 'string' ? activity.name.slice(0, 200) : 'Workout',
        // "TrailRun" and "VirtualRide" read better spaced out.
        sport: sport.replace(/([a-z])([A-Z])/g, '$1 $2').slice(0, 40),
        distance: count(activity.distance),
        movingTime: count(activity.moving_time),
        elapsedTime: count(activity.elapsed_time),
        elevation: count(activity.total_elevation_gain),
        startedAt: wallClock(activity.start_date_local),
        // A treadmill run has no route, which is fine — the card still works.
        polyline: isPolyline(polyline) ? polyline : '',
        averageHeartrate:
          typeof activity.average_heartrate === 'number' ? activity.average_heartrate : null,
        kudos: count(activity.kudos_count),
        url: `https://www.strava.com/activities/${id}`,
      },
    ]
  })
}

/** The athlete's name, for the settings screen. */
export async function athleteName(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/athlete`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as { firstname?: unknown; lastname?: unknown }
    const name = [data.firstname, data.lastname].filter((n) => typeof n === 'string').join(' ')
    return name.trim() || null
  } catch {
    return null
  }
}
