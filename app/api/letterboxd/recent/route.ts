import { NextResponse } from 'next/server'
import { FeedError, recentWatches, username } from '@/lib/letterboxd/feed'

/**
 * Recently watched films for a Letterboxd member.
 *
 * Read on the server: the feed sends no CORS headers, so a browser can't
 * fetch it directly. No key is involved — the feed is public.
 */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get('user')?.slice(0, 120) ?? ''
  const user = username(asked)

  if (!user) {
    return NextResponse.json(
      { error: 'That is not a Letterboxd username — try just the name, like "dave"' },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json({ user, watches: await recentWatches(user) })
  } catch (err) {
    console.error('[letterboxd] reading the feed failed', err)
    const known = err instanceof FeedError
    return NextResponse.json(
      { error: known ? err.message : 'Could not read that feed' },
      { status: known ? err.status : 502 }
    )
  }
}
