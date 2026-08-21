import { NextResponse } from 'next/server'
import { SteamError, searchGames } from '@/lib/steam/api'

/**
 * Finds a game by name. Needs no key and no sign-in — this is Steam's public
 * store search, so the Games tab is useful before anything is set up.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 200) ?? ''
  if (!query) {
    return NextResponse.json({ error: 'Type a game to search for' }, { status: 400 })
  }

  try {
    return NextResponse.json({ games: await searchGames(query) })
  } catch (err) {
    console.error('[steam] game search failed', err)
    const message = err instanceof SteamError ? err.message : 'Game search failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
