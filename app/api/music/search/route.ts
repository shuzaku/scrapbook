import { NextResponse } from 'next/server'
import { MusicSearchError, searchTracks } from '@/lib/music/itunes'

/**
 * Looks a song up by name or artist.
 *
 * No credentials of any kind — Apple's search is open, which makes this the
 * one music lookup that works without an account.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 200) ?? ''
  if (!query) {
    return NextResponse.json({ error: 'Type something to search for' }, { status: 400 })
  }

  try {
    return NextResponse.json({ tracks: await searchTracks(query) })
  } catch (err) {
    console.error('[music] search failed', err)
    const message = err instanceof MusicSearchError ? err.message : 'Song search failed'
    const status = err instanceof MusicSearchError && err.status === 429 ? 429 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
