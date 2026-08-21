import { NextResponse } from 'next/server'
import { MapsError, isMapsConfigured, searchPlaces } from '@/lib/google/maps'

/** Looks a place up by name — a shop, a restaurant, a beach. */
export async function POST(request: Request) {
  if (!isMapsConfigured()) {
    return NextResponse.json(
      { error: 'Google Maps isn’t set up yet — add GOOGLE_MAPS_API_KEY.' },
      { status: 501 }
    )
  }

  const { query } = (await request.json().catch(() => ({}))) as { query?: string }
  const text = String(query ?? '').trim().slice(0, 200)
  if (!text) {
    return NextResponse.json({ error: 'Type something to look for' }, { status: 400 })
  }

  try {
    const { results, exact } = await searchPlaces(text)
    return NextResponse.json({ results, exact })
  } catch (err) {
    console.error('[maps] place search failed', err)
    const status = err instanceof MapsError ? err.status : 502
    const message = err instanceof MapsError ? err.message : 'Could not search for that place'
    return NextResponse.json({ error: message }, { status: status === 501 ? 501 : 502 })
  }
}
