/**
 * Film lookup through Cinemeta.
 *
 * Cinemeta is Stremio's public metadata catalogue — an addon endpoint meant to
 * be called by clients, with no key and no account. It carries IMDb ids, so a
 * sticker can link to the film's IMDb page.
 *
 * The alternatives were worse for a keyless app: TMDB and OMDb both want an
 * API key, and Apple's own movie search answers zero for almost everything
 * since they restricted the `media=movie` filter.
 */
import { MediaSearchError, type MediaResult } from './types'

const CATALOGUE = 'https://v3-cinemeta.strem.io/catalog/movie/top'

interface RawMeta {
  id?: unknown
  imdb_id?: unknown
  name?: unknown
  poster?: unknown
  releaseInfo?: unknown
  year?: unknown
  runtime?: unknown
  imdbRating?: unknown
  director?: unknown
  cast?: unknown
}

/** IMDb ids are tt followed by digits — checked before going in a link. */
export function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && /^tt\d{5,12}$/.test(value)
}

function firstName(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

/**
 * The year out of Cinemeta's release info, which is "2010" for a film and
 * "2008-2013" for anything with a run.
 */
function releaseYear(meta: RawMeta): number | null {
  const raw = typeof meta.releaseInfo === 'string' ? meta.releaseInfo : String(meta.year ?? '')
  const found = raw.match(/\d{4}/)
  if (!found) return null

  const year = Number(found[0])
  return year > 1800 && year < 2200 ? year : null
}

export async function searchFilms(query: string, limit = 12): Promise<MediaResult[]> {
  let res: Response
  try {
    res = await fetch(`${CATALOGUE}/search=${encodeURIComponent(query)}.json`, {
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new MediaSearchError('Could not reach the film catalogue', 502)
  }

  if (!res.ok) throw new MediaSearchError(`The film catalogue answered ${res.status}`, 502)

  const body = (await res.json().catch(() => null)) as { metas?: unknown } | null
  const metas = Array.isArray(body?.metas) ? (body.metas as RawMeta[]) : []

  return metas.slice(0, limit).flatMap((meta) => {
    const title = typeof meta.name === 'string' ? meta.name.trim() : ''
    const id = isImdbId(meta.imdb_id) ? meta.imdb_id : isImdbId(meta.id) ? meta.id : null
    if (!title || !id) return []

    const runtime = typeof meta.runtime === 'string' ? meta.runtime.trim() : ''
    const rating = typeof meta.imdbRating === 'string' ? meta.imdbRating.trim() : ''
    const poster = typeof meta.poster === 'string' && meta.poster.startsWith('https://')
      ? meta.poster
      : null

    return [
      {
        key: id,
        medium: 'film' as const,
        title: title.slice(0, 200),
        // The director is the name worth printing; the lead actor stands in
        // when Cinemeta has no director, which happens on older entries.
        creator: (firstName(meta.director) || firstName(meta.cast)).slice(0, 200),
        year: releaseYear(meta),
        detail: runtime.slice(0, 40),
        rating: /^\d+(\.\d+)?$/.test(rating) ? rating : '',
        url: `https://www.imdb.com/title/${id}/`,
        coverUrl: poster,
      },
    ]
  })
}
