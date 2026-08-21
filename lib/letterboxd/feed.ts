/**
 * What you've been watching, from a Letterboxd RSS feed.
 *
 * Letterboxd's real API has been in closed beta for years and needs approval.
 * The per-member RSS feed needs nothing at all, and carries the part worth
 * having in a journal: the film, the date you watched it, your own star
 * rating, and whether it was a rewatch.
 *
 * The feed is well-formed and narrow, so it's read with targeted matches
 * rather than a whole XML parser. Anything that doesn't look right is skipped.
 */

export interface Watch {
  /** Stable id from the feed, unique per watch. */
  id: string
  title: string
  year: number | null
  /** Your rating, 0.5 to 5, or null when you didn't leave one. */
  rating: number | null
  /** The day you watched it, as yyyy-mm-dd. */
  watchedAt: string | null
  rewatch: boolean
  /** Your entry for it on Letterboxd. */
  url: string
  posterUrl: string | null
}

export class FeedError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'FeedError'
  }
}

/** Letterboxd usernames are letters, numbers, underscores. */
const USERNAME = /^[a-zA-Z0-9_]{2,30}$/

/**
 * Takes a username out of whatever was pasted — the name alone, with an @, or
 * any letterboxd.com address belonging to them.
 */
export function username(input: string): string | null {
  const trimmed = input.trim().replace(/^@/, '')
  if (!trimmed) return null

  if (USERNAME.test(trimmed)) return trimmed

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (!/^(www\.)?letterboxd\.com$/i.test(url.hostname)) return null

    const first = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return USERNAME.test(first) ? first : null
  } catch {
    return null
  }
}

export function feedUrl(user: string): string {
  return `https://letterboxd.com/${user}/rss/`
}

function tag(item: string, name: string): string {
  // The feed uses no attributes on these, which keeps the match simple.
  const found = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return found ? decode(found[1].trim()) : ''
}

/** The handful of entities Letterboxd emits in titles. */
function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

/** Posters live in the description's HTML, which is the only place they appear. */
function poster(item: string): string | null {
  const found = item.match(/<img src="(https:\/\/[^"]+)"/)
  if (!found) return null

  const url = decode(found[1])
  try {
    const parsed = new URL(url)
    // Letterboxd's own image host, checked because this ends up being fetched.
    return parsed.hostname.toLowerCase() === 'a.ltrbxd.com' ? url : null
  } catch {
    return null
  }
}

export function parseFeed(xml: string, limit = 30): Watch[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  const watches: Watch[] = []

  for (const item of items) {
    // A member's feed carries lists and written reviews as well as watches.
    // Only entries naming a film are of interest.
    const title = tag(item, 'letterboxd:filmTitle')
    if (!title) continue

    const id = tag(item, 'guid') || tag(item, 'link')
    if (!id) continue

    const link = tag(item, 'link')
    let url = ''
    try {
      const parsed = new URL(link)
      if (/^(www\.)?letterboxd\.com$/i.test(parsed.hostname) && parsed.protocol === 'https:') {
        url = link
      }
    } catch {
      // No usable link; the watch is still worth showing.
    }

    const year = Number(tag(item, 'letterboxd:filmYear'))
    const rating = Number(tag(item, 'letterboxd:memberRating'))
    const watched = tag(item, 'letterboxd:watchedDate')

    watches.push({
      id,
      title: title.slice(0, 200),
      year: Number.isFinite(year) && year > 1800 && year < 2200 ? year : null,
      rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : null,
      watchedAt: /^\d{4}-\d{2}-\d{2}$/.test(watched) ? watched : null,
      rewatch: tag(item, 'letterboxd:rewatch').toLowerCase() === 'yes',
      url,
      posterUrl: poster(item),
    })

    if (watches.length >= limit) break
  }

  return watches
}

export async function recentWatches(user: string, limit = 30): Promise<Watch[]> {
  let res: Response
  try {
    res = await fetch(feedUrl(user), {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new FeedError('Could not reach Letterboxd', 502)
  }

  if (res.status === 404) {
    throw new FeedError(`No Letterboxd account called "${user}"`, 404)
  }
  if (!res.ok) throw new FeedError(`Letterboxd answered ${res.status}`, 502)

  return parseFeed(await res.text(), limit)
}
