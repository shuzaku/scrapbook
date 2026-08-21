/**
 * Anime and manga lookup through AniList.
 *
 * AniList's GraphQL endpoint takes anonymous queries — no key, no account, no
 * client id. Jikan (the MyAnimeList wrapper) was the other candidate, but it
 * was answering 504 from MAL's side while this was being written, and it
 * depends on a service it doesn't control.
 */
import { MediaSearchError, type MediaResult } from './types'

const ENDPOINT = 'https://graphql.anilist.co'

/**
 * One query serves both, since AniList models anime and manga as the same
 * Media type with a different discriminator.
 */
const QUERY = `query ($search: String, $type: MediaType, $perPage: Int) {
  Page(perPage: $perPage) {
    media(search: $search, type: $type, sort: SEARCH_MATCH) {
      id
      title { romaji english }
      startDate { year }
      episodes
      chapters
      volumes
      averageScore
      siteUrl
      coverImage { large }
      studios(isMain: true) { nodes { name } }
      staff(perPage: 1) { nodes { name { full } } }
    }
  }
}`

interface RawMedia {
  id?: unknown
  title?: { romaji?: unknown; english?: unknown }
  startDate?: { year?: unknown }
  episodes?: unknown
  chapters?: unknown
  volumes?: unknown
  averageScore?: unknown
  siteUrl?: unknown
  coverImage?: { large?: unknown }
  studios?: { nodes?: unknown }
  staff?: { nodes?: unknown }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/** "26 episodes", "1 episode", or nothing while it's still airing. */
function detailFor(media: RawMedia, type: 'anime' | 'manga'): string {
  if (type === 'anime') {
    const episodes = count(media.episodes)
    return episodes ? `${episodes} episode${episodes === 1 ? '' : 's'}` : ''
  }

  const chapters = count(media.chapters)
  if (chapters) return `${chapters} chapter${chapters === 1 ? '' : 's'}`

  const volumes = count(media.volumes)
  return volumes ? `${volumes} volume${volumes === 1 ? '' : 's'}` : ''
}

/** The studio for anime, the author for manga. */
function creatorFor(media: RawMedia, type: 'anime' | 'manga'): string {
  if (type === 'anime') {
    const nodes = Array.isArray(media.studios?.nodes) ? media.studios.nodes : []
    const first = nodes[0] as { name?: unknown } | undefined
    return text(first?.name)
  }

  const nodes = Array.isArray(media.staff?.nodes) ? media.staff.nodes : []
  const first = nodes[0] as { name?: { full?: unknown } } | undefined
  return text(first?.name?.full)
}

/** AniList's site URLs, checked before one goes in a link. */
export function isAniListUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\/anilist\.co\/(anime|manga)\/\d+(\/.*)?$/.test(value)
}

export async function searchAniList(
  query: string,
  type: 'anime' | 'manga',
  limit = 12
): Promise<MediaResult[]> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: { search: query, type: type.toUpperCase(), perPage: limit },
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new MediaSearchError('Could not reach AniList', 502)
  }

  if (res.status === 429) {
    throw new MediaSearchError('AniList is rate limiting — try again in a moment', 429)
  }
  if (!res.ok) throw new MediaSearchError(`AniList answered ${res.status}`, 502)

  const body = (await res.json().catch(() => null)) as {
    data?: { Page?: { media?: unknown } }
  } | null

  const list = Array.isArray(body?.data?.Page?.media) ? (body.data.Page.media as RawMedia[]) : []

  return list.flatMap((media) => {
    // The English title when there is one, since that's what people search
    // for; the romaji is the fallback and is always present.
    const title = text(media.title?.english) || text(media.title?.romaji)
    const id = typeof media.id === 'number' ? media.id : null
    if (!title || id === null) return []

    const score = count(media.averageScore)
    const cover = text(media.coverImage?.large)

    return [
      {
        key: `${type}-${id}`,
        medium: type,
        title: title.slice(0, 200),
        creator: creatorFor(media, type).slice(0, 200),
        year: count(media.startDate?.year),
        detail: detailFor(media, type),
        // AniList scores out of a hundred; everything else here is out of ten.
        rating: score ? (score / 10).toFixed(1) : '',
        url: isAniListUrl(media.siteUrl)
          ? (media.siteUrl as string)
          : `https://anilist.co/${type}/${id}`,
        coverUrl: cover.startsWith('https://') ? cover : null,
      },
    ]
  })
}
