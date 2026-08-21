/**
 * Reading a public iCloud Shared Album.
 *
 * Apple has no photos API for third parties — iCloud Photos is closed, and
 * PhotoKit only exists inside a native app. A shared album with its public
 * website turned on is the exception: the page it serves is backed by an
 * endpoint that takes no credentials, only the album's token. That makes it
 * the one route from an iPhone's photos into this app without a developer
 * membership or a data export.
 *
 * None of it is documented, so everything here is defensive: unexpected
 * shapes are skipped rather than trusted, and the album's own redirect is
 * followed instead of assuming which server holds it.
 */

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** Tokens are base62 and start with a letter naming the scheme. */
const TOKEN = /^[A-Za-z0-9]{10,40}$/

export interface AlbumPhoto {
  guid: string
  caption: string
  /** ISO wall-clock with no timezone, matching how photo dates are stored. */
  takenAt: string | null
  width: number
  height: number
  /** Largest available rendition, resolved to a fetchable address. */
  url: string
}

export interface Album {
  name: string
  photos: AlbumPhoto[]
}

export class AlbumError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'AlbumError'
  }
}

/**
 * Pulls the token out of whatever was pasted.
 *
 * Apple hands out two forms — icloud.com/sharedalbum/#TOKEN and the shorter
 * share.icloud.com/photos/#TOKEN — and the token is always after the hash.
 */
export function albumToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (TOKEN.test(trimmed) && !trimmed.includes('/')) return trimmed

  const hash = trimmed.split('#')[1] ?? ''
  const token = hash.split(/[?&/]/)[0] ?? ''
  return TOKEN.test(token) ? token : null
}

function base62ToInt(text: string): number {
  let total = 0
  for (const char of text) {
    const index = BASE62.indexOf(char)
    if (index === -1) return 0
    total = total * 62 + index
  }
  return total
}

/**
 * The server holding an album is encoded in its token. A wrong guess isn't
 * fatal — Apple answers 330 with the right host — but starting in the right
 * place saves a round trip.
 */
export function baseUrl(token: string, host?: string): string {
  if (host) return `https://${host}/${token}/sharedstreams/`

  const partition = base62ToInt(token.slice(1, 3))
  const name = partition < 10 ? `0${partition}` : String(partition)
  return `https://p${name}-sharedstreams.icloud.com/${token}/sharedstreams/`
}

async function call(url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      // Apple's own web player sends text/plain here, and the endpoint is
      // fussy about it.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new AlbumError('Could not reach iCloud', 502)
  }

  return { status: res.status, body: await res.json().catch(() => null) }
}

/**
 * Follows the one redirect Apple uses to point at the album's real server.
 * 330 carries the host in the body rather than a Location header.
 */
async function callFollowing(token: string, path: string, body: unknown): Promise<unknown> {
  let answer = await call(`${baseUrl(token)}${path}`, body)

  if (answer.status === 330) {
    const host = (answer.body as { 'X-Apple-MMe-Host'?: unknown })?.['X-Apple-MMe-Host']
    if (typeof host !== 'string' || !/^[a-z0-9-]+\.icloud\.com$/i.test(host)) {
      throw new AlbumError('iCloud redirected somewhere unexpected', 502)
    }
    answer = await call(`${baseUrl(token, host)}${path}`, body)
  }

  if (answer.status === 401 || answer.status === 403) {
    throw new AlbumError('That album is not shared publicly', 403)
  }
  if (answer.status === 404) {
    throw new AlbumError('No album found for that link — check it is still shared', 404)
  }
  if (answer.status !== 200) {
    throw new AlbumError(`iCloud answered ${answer.status}`, 502)
  }

  return answer.body
}

interface RawPhoto {
  photoGuid?: unknown
  caption?: unknown
  dateCreated?: unknown
  batchDateCreated?: unknown
  derivatives?: unknown
}

interface RawDerivative {
  checksum?: unknown
  width?: unknown
  height?: unknown
  fileSize?: unknown
}

/** Apple gives UTC; photo dates elsewhere are wall-clock, so it's converted. */
function wallClock(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null

  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  )
}

/** The biggest rendition on offer, since a page wants the best picture. */
function largest(derivatives: unknown): RawDerivative | null {
  if (!derivatives || typeof derivatives !== 'object') return null

  let best: RawDerivative | null = null
  for (const value of Object.values(derivatives as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue

    const one = value as RawDerivative
    if (typeof one.checksum !== 'string' || !one.checksum) continue

    const height = typeof one.height === 'number' ? one.height : 0
    const bestHeight = typeof best?.height === 'number' ? best.height : -1
    if (height > bestHeight) best = one
  }

  return best
}

/**
 * Everything in one album: its name, and every picture with a fetchable
 * address for the largest rendition Apple holds.
 */
export async function readAlbum(token: string): Promise<Album> {
  const stream = (await callFollowing(token, 'webstream', { streamCtag: null })) as {
    streamName?: unknown
    photos?: unknown
  } | null

  const rawPhotos = Array.isArray(stream?.photos) ? (stream.photos as RawPhoto[]) : []
  if (rawPhotos.length === 0) {
    return { name: typeof stream?.streamName === 'string' ? stream.streamName : '', photos: [] }
  }

  // Keep only what has a usable rendition, and remember which checksum each
  // picture needs so the addresses can be matched back afterwards.
  const wanted: { photo: RawPhoto; derivative: RawDerivative; checksum: string }[] = []
  for (const photo of rawPhotos) {
    if (typeof photo.photoGuid !== 'string') continue
    const derivative = largest(photo.derivatives)
    if (!derivative || typeof derivative.checksum !== 'string') continue
    wanted.push({ photo, derivative, checksum: derivative.checksum })
  }

  const urls = await assetUrls(
    token,
    wanted.map((entry) => entry.photo.photoGuid as string)
  )

  const photos: AlbumPhoto[] = []
  for (const entry of wanted) {
    const url = urls.get(entry.checksum)
    if (!url) continue

    photos.push({
      guid: entry.photo.photoGuid as string,
      caption: typeof entry.photo.caption === 'string' ? entry.photo.caption.slice(0, 200) : '',
      takenAt: wallClock(entry.photo.dateCreated ?? entry.photo.batchDateCreated),
      width: typeof entry.derivative.width === 'number' ? entry.derivative.width : 0,
      height: typeof entry.derivative.height === 'number' ? entry.derivative.height : 0,
      url,
    })
  }

  return {
    name: typeof stream?.streamName === 'string' ? stream.streamName.slice(0, 200) : '',
    photos,
  }
}

/**
 * Turns photo ids into signed addresses.
 *
 * Asked for in batches: the endpoint refuses very large requests, and an
 * album can hold hundreds of pictures.
 */
async function assetUrls(token: string, guids: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()

  for (let at = 0; at < guids.length; at += 100) {
    const body = (await callFollowing(token, 'webasseturls', {
      photoGuids: guids.slice(at, at + 100),
    })) as { items?: unknown } | null

    const items = body?.items
    if (!items || typeof items !== 'object') continue

    for (const [checksum, value] of Object.entries(items as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue

      const item = value as { url_location?: unknown; url_path?: unknown }
      if (typeof item.url_location !== 'string' || typeof item.url_path !== 'string') continue

      // Built here rather than trusted whole, and checked again before it is
      // fetched.
      found.set(checksum, `https://${item.url_location}${item.url_path}`)
    }
  }

  return found
}

/**
 * Guards an asset address before the server fetches it.
 *
 * The addresses come from Apple's own answer, but they arrive over the wire
 * and end up in a server-side fetch, so the host is checked rather than
 * assumed.
 */
export function isAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false

    const host = parsed.hostname.toLowerCase()
    return host === 'cvws.icloud-content.com' || host.endsWith('.icloud-content.com')
  } catch {
    return false
  }
}
