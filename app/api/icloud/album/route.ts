import { NextResponse } from 'next/server'
import { AlbumError, albumToken, readAlbum } from '@/lib/icloud/sharedalbum'

/**
 * Lists what's in a public iCloud Shared Album.
 *
 * Read on the server, because the album endpoint doesn't allow browser
 * requests from another origin. Nothing is downloaded here — that happens
 * only for the pictures actually chosen.
 */
export async function POST(request: Request) {
  const { url } = (await request.json().catch(() => ({}))) as { url?: string }

  const token = typeof url === 'string' ? albumToken(url) : null
  if (!token) {
    return NextResponse.json(
      { error: 'That is not a shared album link — it should look like icloud.com/sharedalbum/#B0…' },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json(await readAlbum(token))
  } catch (err) {
    console.error('[icloud] reading the album failed', err)
    const known = err instanceof AlbumError
    return NextResponse.json(
      { error: known ? err.message : 'Could not read that album' },
      { status: known ? err.status : 502 }
    )
  }
}
