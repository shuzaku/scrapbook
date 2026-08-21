/**
 * What you've been listening to.
 *
 * Only `recently-played` is used — one endpoint, one scope. Spotify's terms
 * require cover art to be shown unmodified and to link back to the track, so
 * the art is stored as served and every sticker carries its Spotify URL.
 */
import { API } from './config'

export interface Play {
  /** Spotify's track id, used to spot the same song twice in a row. */
  id: string
  title: string
  artist: string
  album: string
  /** Cover art, largest first from Spotify's own CDN. */
  artUrl: string | null
  /** ISO timestamp of when it was played. */
  playedAt: string
  /** The track on Spotify — required attribution, and a working link. */
  url: string
}

export class SpotifyError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'SpotifyError'
  }
}

interface RawItem {
  played_at?: string
  track?: {
    id?: string
    name?: string
    artists?: { name?: string }[]
    external_urls?: { spotify?: string }
    album?: {
      name?: string
      images?: { url?: string; width?: number; height?: number }[]
    }
  }
}

/** The most recent plays, newest first. */
export async function recentlyPlayed(token: string, limit = 20): Promise<Play[]> {
  const res = await fetch(`${API}/me/player/recently-played?limit=${Math.min(50, limit)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    throw new SpotifyError(detail || `Spotify request failed (${res.status})`, res.status)
  }

  const data = (await res.json()) as { items?: RawItem[] }

  return (data.items ?? []).flatMap((item): Play[] => {
    const track = item.track
    if (!track?.name) return []

    // Images come widest first; the first is the 640px cover.
    const artUrl = track.album?.images?.find((image) => image.url)?.url ?? null

    return [
      {
        id: track.id ?? '',
        title: track.name,
        artist: (track.artists ?? []).map((a) => a.name).filter(Boolean).join(', '),
        album: track.album?.name ?? '',
        artUrl,
        playedAt: item.played_at ?? '',
        url: track.external_urls?.spotify ?? '',
      },
    ]
  })
}

/** The display name on the account, for showing which one is connected. */
export async function currentUserName(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const me = (await res.json()) as { display_name?: string; email?: string }
    return me.display_name ?? me.email ?? null
  } catch {
    return null
  }
}

/** Cover art must come from Spotify's own CDN — never an arbitrary URL. */
export function isSpotifyImage(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.scdn.co')
  } catch {
    return false
  }
}
