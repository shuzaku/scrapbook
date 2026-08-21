/**
 * What the weather actually was, from Open-Meteo.
 *
 * No key, no account, and — the part that matters for a journal — a real
 * archive rather than only a forecast. Every entry already has a date, so
 * given a place this can say what the day was like long after the fact.
 *
 * Open-Meteo's own geocoder is used rather than Google's, so the whole thing
 * works without the Maps key.
 */

const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'

const DAILY = 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum'

export type Unit = 'c' | 'f'

export interface Place {
  name: string
  /** "Kyoto, Japan" — what goes on the sticker. */
  label: string
  latitude: number
  longitude: number
}

export interface DayWeather {
  date: string
  high: number | null
  low: number | null
  /** WMO code; see describe(). */
  code: number
  /** Millimetres, or inches when asked in Fahrenheit. */
  precip: number | null
  unit: Unit
}

export class WeatherError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'WeatherError'
  }
}

/** WMO weather codes, grouped the way a person would describe the day. */
const CONDITIONS: { codes: number[]; label: string; icon: string }[] = [
  { codes: [0], label: 'Clear', icon: '☀️' },
  { codes: [1], label: 'Mostly clear', icon: '🌤️' },
  { codes: [2], label: 'Partly cloudy', icon: '⛅' },
  { codes: [3], label: 'Overcast', icon: '☁️' },
  { codes: [45, 48], label: 'Fog', icon: '🌫️' },
  { codes: [51, 53, 55], label: 'Drizzle', icon: '🌦️' },
  { codes: [56, 57], label: 'Freezing drizzle', icon: '🌧️' },
  { codes: [61, 63, 65], label: 'Rain', icon: '🌧️' },
  { codes: [66, 67], label: 'Freezing rain', icon: '🌧️' },
  { codes: [71, 73, 75, 77], label: 'Snow', icon: '❄️' },
  { codes: [80, 81, 82], label: 'Showers', icon: '🌦️' },
  { codes: [85, 86], label: 'Snow showers', icon: '🌨️' },
  { codes: [95], label: 'Thunderstorm', icon: '⛈️' },
  { codes: [96, 99], label: 'Hail storm', icon: '⛈️' },
]

export function describe(code: number): { label: string; icon: string } {
  return (
    CONDITIONS.find((one) => one.codes.includes(code)) ?? { label: 'Unknown', icon: '🌡️' }
  )
}

/** Dates are handled as plain days, the way an entry's date is. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

export function isDay(value: unknown): value is string {
  return typeof value === 'string' && DAY.test(value)
}

async function get(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new WeatherError('Could not reach the weather service', 502)
  }

  if (res.status === 429) {
    throw new WeatherError('The weather service is rate limiting — try again shortly', 429)
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // Open-Meteo explains itself in a `reason` field, which is usually worth
    // showing: "start_date is out of allowed range" and so on.
    const reason = (body as { reason?: unknown } | null)?.reason
    throw new WeatherError(
      typeof reason === 'string' ? reason : `The weather service answered ${res.status}`,
      502
    )
  }

  return body
}

/** Finds a place by name, so nobody has to type coordinates. */
export async function geocode(query: string, limit = 5): Promise<Place[]> {
  const params = new URLSearchParams({
    name: query,
    count: String(limit),
    language: 'en',
    format: 'json',
  })

  const body = (await get(`${GEOCODE}?${params}`)) as { results?: unknown } | null
  const results = Array.isArray(body?.results) ? body.results : []

  return results.flatMap((value) => {
    const row = value as {
      name?: unknown
      country?: unknown
      admin1?: unknown
      latitude?: unknown
      longitude?: unknown
    }

    if (
      typeof row.name !== 'string' ||
      typeof row.latitude !== 'number' ||
      typeof row.longitude !== 'number'
    ) {
      return []
    }

    // "Kyoto, Kyoto, Japan" reads badly, so the region is dropped when it only
    // repeats the town.
    const region = typeof row.admin1 === 'string' && row.admin1 !== row.name ? row.admin1 : ''
    const country = typeof row.country === 'string' ? row.country : ''

    return [
      {
        name: row.name,
        label: [row.name, region, country].filter(Boolean).join(', '),
        latitude: row.latitude,
        longitude: row.longitude,
      },
    ]
  })
}

function reading(daily: Record<string, unknown>, key: string): number | null {
  const values = daily[key]
  if (!Array.isArray(values)) return null

  const value = values[0]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * The weather on one day at one place.
 *
 * The archive is authoritative but stops a couple of days short of today, so
 * the forecast endpoint — which also carries the recent past — fills the gap.
 */
export async function dayWeather(
  latitude: number,
  longitude: number,
  date: string,
  unit: Unit = 'c'
): Promise<DayWeather> {
  if (!isDay(date)) throw new WeatherError('That is not a date', 400)

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: date,
    end_date: date,
    daily: DAILY,
    timezone: 'auto',
  })

  if (unit === 'f') {
    params.set('temperature_unit', 'fahrenheit')
    params.set('precipitation_unit', 'inch')
  }

  const read = async (base: string): Promise<DayWeather | null> => {
    const body = (await get(`${base}?${params}`)) as { daily?: unknown } | null
    const daily = body?.daily
    if (!daily || typeof daily !== 'object') return null

    const values = daily as Record<string, unknown>
    const high = reading(values, 'temperature_2m_max')
    const low = reading(values, 'temperature_2m_min')
    if (high === null && low === null) return null

    return {
      date,
      high,
      low,
      code: reading(values, 'weather_code') ?? 0,
      precip: reading(values, 'precipitation_sum'),
      unit,
    }
  }

  const archived = await read(ARCHIVE)
  if (archived) return archived

  const recent = await read(FORECAST).catch(() => null)
  if (recent) return recent

  throw new WeatherError('No weather recorded for that day and place', 404)
}
