/**
 * Looking a song up by name.
 *
 * Apple's iTunes Search API needs no key, no account and no subscription,
 * which makes it the one music lookup that works out of the box. It's limited
 * to roughly 20 calls a minute, so searches are deliberately deliberate — one
 * per submit, not per keystroke.
 */

const SEARCH = 'https://itunes.apple.com/search'

export interface TrackResult {
  id: string
  title: string
  artist: string
  album: string
  /** Cover art, upgraded from the thumbnail Apple returns by default. */
  artUrl: string | null
  /** The track on Apple Music. */
  url: string
  source: 'itunes'
}

export class MusicSearchError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'MusicSearchError'
  }
}

interface RawTrack {
  trackId?: number
  trackName?: string
  artistName?: string
  collectionName?: string
  artworkUrl100?: string
  trackViewUrl?: string
}

/**
 * Apple returns a 100px thumbnail; the size is just a path segment, so a
 * page-worthy cover is the same URL with a bigger number.
 */
function biggerArt(url: string | undefined): string | null {
  if (!url) return null
  return url.replace(/\/\d+x\d+bb\./, '/600x600bb.')
}

export async function searchTracks(query: string, limit = 12): Promise<TrackResult[]> {
  const params = new URLSearchParams({
    term: query,
    entity: 'song',
    media: 'music',
    limit: String(Math.min(25, limit)),
  })

  const res = await fetch(`${SEARCH}?${params}`, { cache: 'no-store' })

  if (res.status === 403 || res.status === 429) {
    throw new MusicSearchError(
      'Apple is rate-limiting searches just now — wait a moment and try again.',
      429
    )
  }
  if (!res.ok) {
    throw new MusicSearchError(`Song search failed (${res.status})`, res.status)
  }

  const data = (await res.json()) as { results?: RawTrack[] }

  return (data.results ?? []).flatMap((track): TrackResult[] => {
    if (!track.trackName) return []
    return [
      {
        id: String(track.trackId ?? `${track.trackName}-${track.artistName}`),
        title: track.trackName,
        artist: track.artistName ?? '',
        album: track.collectionName ?? '',
        artUrl: biggerArt(track.artworkUrl100),
        url: track.trackViewUrl ?? '',
        source: 'itunes',
      },
    ]
  })
}
