/**
 * Where artwork may be fetched from — covers, box art, achievement icons.
 *
 * Art URLs arrive from search results and API responses, so they're checked
 * against the hosts the services actually serve images on, never fetched from
 * wherever a request happens to point.
 */

/** Matched on the whole hostname. */
const EXACT_HOSTS = [
  // Steam serves achievement icons from its old Akamai host rather than the
  // steamstatic one used for store art. Only this exact host is allowed —
  // akamaihd.net at large is a shared CDN belonging to many other people.
  'steamcdn-a.akamaihd.net',
  'media.steampowered.com',
  // Book jackets.
  'covers.openlibrary.org',
  // Film posters, from Cinemeta and the artwork host it points at.
  'images.metahub.space',
  'm.media-amazon.com',
  // Anime and manga covers.
  's4.anilist.co',
  // Letterboxd film posters.
  'a.ltrbxd.com',
]

/** Matched on the end of the hostname, so any subdomain counts. */
const HOST_SUFFIXES = [
  '.scdn.co', // Spotify
  '.mzstatic.com', // Apple
  '.steamstatic.com', // Steam store and community art
]

export function isAllowedArtUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false

    const host = parsed.hostname.toLowerCase()
    return EXACT_HOSTS.includes(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  } catch {
    return false
  }
}
