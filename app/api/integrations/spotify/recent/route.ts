import { NextResponse } from 'next/server'
import { SpotifyError, recentlyPlayed } from '@/lib/spotify/api'
import { getSpotifyToken } from '@/lib/spotify/tokens'

/** The recent plays, for the editor's Music tab. */
export async function GET() {
  const token = await getSpotifyToken()
  if (!token) {
    return NextResponse.json({ error: 'Not connected to Spotify' }, { status: 401 })
  }

  try {
    return NextResponse.json({ plays: await recentlyPlayed(token, 20) })
  } catch (err) {
    console.error('[spotify] fetching recent plays failed', err)
    if (err instanceof SpotifyError && err.status === 403) {
      // Spotify says why in the body, and it's usually specific — a Premium
      // requirement, or an account missing from the app's allow-list. Guessing
      // between them just sends people down the wrong path.
      const detail = err.message.trim()
      const premium = /premium/i.test(detail)

      return NextResponse.json(
        {
          error: premium
            ? `Spotify: ${detail} Web API access needs the account that owns the Spotify app to have Premium.`
            : `Spotify refused that request — ${detail || 'no reason given'}. If the app is in development mode, check your account is listed under Users and Access.`,
        },
        { status: 403 }
      )
    }

    const detail = err instanceof SpotifyError ? err.message.trim() : ''
    return NextResponse.json(
      { error: detail ? `Spotify: ${detail}` : 'Could not read your recent plays' },
      { status: 502 }
    )
  }
}
