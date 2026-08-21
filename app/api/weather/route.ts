import { NextResponse } from 'next/server'
import { WeatherError, dayWeather, geocode, isDay } from '@/lib/weather/openmeteo'

/**
 * Finds places, and says what the weather was.
 *
 * Without coordinates it geocodes and hands back the matches; with them it
 * returns the day's weather. Neither needs a key.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const place = params.get('place')?.trim().slice(0, 120) ?? ''
  const date = params.get('date') ?? ''
  const unit = params.get('unit') === 'f' ? 'f' : 'c'

  // Read as text first: Number(null) is 0, which is a perfectly finite
  // number, and would make a request with no coordinates look located.
  const lat = params.get('lat')
  const lon = params.get('lon')
  const latitude = Number(lat)
  const longitude = Number(lon)
  const located =
    lat !== null && lon !== null && Number.isFinite(latitude) && Number.isFinite(longitude)

  try {
    if (!located) {
      if (!place) return NextResponse.json({ error: 'Type a place' }, { status: 400 })
      return NextResponse.json({ places: await geocode(place) })
    }

    if (!isDay(date)) {
      return NextResponse.json({ error: 'That is not a date' }, { status: 400 })
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: 'That is not a place on earth' }, { status: 400 })
    }

    return NextResponse.json({ weather: await dayWeather(latitude, longitude, date, unit) })
  } catch (err) {
    console.error('[weather] lookup failed', err)
    const known = err instanceof WeatherError
    return NextResponse.json(
      { error: known ? err.message : 'Weather lookup failed' },
      { status: known ? err.status : 502 }
    )
  }
}
