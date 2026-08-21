/**
 * Instagram post embeds.
 *
 * There is no API here and no key: Instagram serves a plain HTML page at
 * /p/<shortcode>/embed/ with no X-Frame-Options and no frame-ancestors, which
 * is exactly what it's for. Paste a post's address and the page frames it.
 *
 * The trade this makes is worth being clear about. Everything else on a page
 * — photos, cover art, map images — is downloaded and kept locally, so a
 * finished page survives on its own. An embed doesn't: it's a window onto
 * Instagram. If the post is deleted, or the account turns private, or there's
 * no network, the frame comes up empty. Only public posts embed at all.
 */

/** Instagram keeps three paths for what is really the same object. */
export type EmbedPath = 'p' | 'reel' | 'tv'

export interface ParsedPost {
  shortcode: string
  path: EmbedPath
  /** The tidied post address, for linking back out. */
  url: string
}

const PATHS: EmbedPath[] = ['p', 'reel', 'tv']

/** Instagram shortcodes are base64url-ish and about eleven characters. */
const SHORTCODE = /^[A-Za-z0-9_-]{5,30}$/

const HOSTS = ['instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am']

/**
 * Reads a post address, however it was copied.
 *
 * Handles the share link with its tracking query, the mobile host, a missing
 * scheme, and a bare shortcode pasted on its own.
 */
export function parsePostUrl(input: string): ParsedPost | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // A bare shortcode is the most likely thing someone types by hand.
  if (!trimmed.includes('/') && SHORTCODE.test(trimmed)) {
    return { shortcode: trimmed, path: 'p', url: postUrl(trimmed, 'p') }
  }

  let parsed: URL
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }

  if (!HOSTS.includes(parsed.hostname.toLowerCase())) return null

  const segments = parsed.pathname.split('/').filter(Boolean)
  // A post is /p/<code>, and /<username>/p/<code> is also handed out.
  const at = segments.findIndex((segment) => PATHS.includes(segment as EmbedPath))
  if (at === -1) return null

  const path = segments[at] as EmbedPath
  const shortcode = segments[at + 1] ?? ''
  if (!SHORTCODE.test(shortcode)) return null

  return { shortcode, path, url: postUrl(shortcode, path) }
}

/** The canonical address of the post itself. */
export function postUrl(shortcode: string, path: EmbedPath): string {
  return `https://www.instagram.com/${path}/${shortcode}/`
}

/**
 * The frameable address.
 *
 * `captioned` asks Instagram to include the caption below the picture, which
 * is the version worth putting on a scrapbook page.
 */
export function embedUrl(shortcode: string, path: EmbedPath, captioned = true): string {
  return `https://www.instagram.com/${path}/${shortcode}/embed${captioned ? '/captioned' : ''}/`
}

/** Guards a stored shortcode before it's put in a frame address. */
export function isShortcode(value: unknown): value is string {
  return typeof value === 'string' && SHORTCODE.test(value)
}

/** Guards a stored path segment. */
export function isEmbedPath(value: unknown): value is EmbedPath {
  return typeof value === 'string' && PATHS.includes(value as EmbedPath)
}
