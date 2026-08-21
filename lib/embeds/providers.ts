/**
 * Things from elsewhere, framed on a page.
 *
 * Three services, none of which needs a key: Instagram, YouTube and
 * Twitter/X all serve a frameable page for public posts, with no
 * X-Frame-Options and no frame-ancestors to stop it.
 *
 * The trade is the same for all three, and worth being clear about. Every
 * other element keeps its picture locally, so a finished page survives on its
 * own. An embed is a window: if the post comes down, the account goes private,
 * or there's no network, the frame is empty.
 */
import { embedUrl as instagramSrc, parsePostUrl, type EmbedPath } from './instagram'

export type EmbedProvider = 'instagram' | 'youtube' | 'twitter'

export interface ParsedEmbed {
  provider: EmbedProvider
  /** Shortcode, video id, or tweet id, depending on the service. */
  id: string
  /** Instagram only: which of its three paths the post lives on. */
  path: EmbedPath
  /** YouTube only: seconds in to start from. */
  start: number
  /** The tidied address of the thing itself, for linking back out. */
  url: string
}

const PROVIDERS: EmbedProvider[] = ['instagram', 'youtube', 'twitter']

export function isEmbedProvider(value: unknown): value is EmbedProvider {
  return typeof value === 'string' && PROVIDERS.includes(value as EmbedProvider)
}

/** YouTube ids are exactly eleven base64url characters. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
/**
 * Tweet ids are decimal numbers. Modern ones are 19-digit snowflakes, but the
 * earliest tweets have tiny ids — Jack's first is literally 20 — so there is
 * no useful minimum.
 */
const TWEET_ID = /^\d{1,25}$/

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]

const TWITTER_HOSTS = [
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
  'x.com',
  'www.x.com',
  'mobile.x.com',
]

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value)
}

export function isTweetId(value: unknown): value is string {
  return typeof value === 'string' && TWEET_ID.test(value)
}

/**
 * Seconds out of YouTube's start parameter, which comes as either a plain
 * number or the "1h2m3s" form used in share links.
 */
function startSeconds(raw: string | null): number {
  if (!raw) return 0

  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 86_400)

  const found = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!found || !found[0]) return 0

  const seconds =
    Number(found[1] ?? 0) * 3600 + Number(found[2] ?? 0) * 60 + Number(found[3] ?? 0)
  return Math.min(seconds, 86_400)
}

function parseYouTube(url: URL): ParsedEmbed | null {
  const segments = url.pathname.split('/').filter(Boolean)
  const host = url.hostname.toLowerCase()

  // youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID
  let id = ''
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = segments[0] ?? ''
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v') ?? ''
  } else if (['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')) {
    id = segments[1] ?? ''
  }

  if (!isVideoId(id)) return null

  return {
    provider: 'youtube',
    id,
    path: 'p',
    start: startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start')),
    url: `https://www.youtube.com/watch?v=${id}`,
  }
}

function parseTwitter(url: URL): ParsedEmbed | null {
  const segments = url.pathname.split('/').filter(Boolean)
  // /<user>/status/<id>, and the older /statuses/ spelling.
  const at = segments.findIndex((segment) => segment === 'status' || segment === 'statuses')
  const id = at === -1 ? '' : (segments[at + 1] ?? '')

  if (!isTweetId(id)) return null

  const user = segments[0] ?? 'i'
  return {
    provider: 'twitter',
    id,
    path: 'p',
    start: 0,
    // x.com is the canonical host now; twitter.com still redirects to it.
    url: `https://x.com/${/^[A-Za-z0-9_]{1,15}$/.test(user) ? user : 'i'}/status/${id}`,
  }
}

/**
 * Reads any of the three services' addresses.
 *
 * Whatever was copied — a share link with tracking, the mobile host, no
 * scheme — only the id survives, and the link is rebuilt from it.
 */
export function parseEmbedUrl(input: string): ParsedEmbed | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    // Not an address at all — Instagram accepts a bare shortcode, so give it
    // the chance to claim this.
    return fromInstagram(trimmed)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase()
  if (YOUTUBE_HOSTS.includes(host)) return parseYouTube(url)
  if (TWITTER_HOSTS.includes(host)) return parseTwitter(url)

  return fromInstagram(trimmed)
}

/** Instagram's own parser, mapped onto the shared shape. */
function fromInstagram(input: string): ParsedEmbed | null {
  const post = parsePostUrl(input)
  if (!post) return null

  return {
    provider: 'instagram',
    id: post.shortcode,
    path: post.path,
    start: 0,
    url: post.url,
  }
}

/** The frameable address for a stored embed. */
export function embedSrc(embed: {
  provider: EmbedProvider
  mediaId: string
  path: EmbedPath
  start: number
  display: 'captioned' | 'bare'
}): string {
  if (embed.provider === 'youtube') {
    const params = new URLSearchParams({ rel: '0' })
    if (embed.start > 0) params.set('start', String(embed.start))
    // The nocookie host doesn't set tracking cookies until the video plays.
    return `https://www.youtube-nocookie.com/embed/${embed.mediaId}?${params}`
  }

  if (embed.provider === 'twitter') {
    const params = new URLSearchParams({
      id: embed.mediaId,
      theme: 'light',
      // Do Not Track: asks the widget not to personalise or report back.
      dnt: 'true',
      widgetsVersion: '2615f7e52b7e0:1702314776716',
    })
    return `https://platform.twitter.com/embed/Tweet.html?${params}`
  }

  return instagramSrc(embed.mediaId, embed.path, embed.display === 'captioned')
}

/** Where the thing itself lives, for the link out. */
export function sourceUrl(provider: EmbedProvider, id: string, path: EmbedPath): string {
  if (provider === 'youtube') return `https://www.youtube.com/watch?v=${id}`
  if (provider === 'twitter') return `https://x.com/i/status/${id}`
  return `https://www.instagram.com/${path}/${id}/`
}

/** Checks a stored id against the shape its service actually uses. */
export function isEmbedId(provider: EmbedProvider, value: unknown): value is string {
  if (provider === 'youtube') return isVideoId(value)
  if (provider === 'twitter') return isTweetId(value)
  return typeof value === 'string' && /^[A-Za-z0-9_-]{5,30}$/.test(value)
}

/** A sensible starting shape for each, in page units. */
export function defaultSize(provider: EmbedProvider): { w: number; h: number } {
  // Video is 16:9 with room for the controls; a tweet is a tall column.
  if (provider === 'youtube') return { w: 480, h: 290 }
  if (provider === 'twitter') return { w: 380, h: 420 }
  return { w: 360, h: 520 }
}

export const PROVIDER_LABEL: Record<EmbedProvider, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X',
}
