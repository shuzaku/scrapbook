/**
 * Canvas vocabulary shared by the editor, the read-only page view and the
 * server. Everything here is pure data — safe to import from anywhere.
 */
import type { CSSProperties } from 'react'
import { MAP_STYLES, type MapStyle } from '@/lib/google/maps-shared'
import { isEmbedPath, type EmbedPath } from '@/lib/embeds/instagram'
import {
  defaultSize,
  isEmbedId,
  isEmbedProvider,
  sourceUrl,
  type EmbedProvider,
} from '@/lib/embeds/providers'
import { isWorkKey } from '@/lib/books/openlibrary'
import { isAniListUrl } from '@/lib/media/anilist'
import { isImdbId } from '@/lib/media/cinemeta'
import { isMedium, type Medium } from '@/lib/media/types'
import { isPolyline } from '@/lib/strava/polyline'
import { elementScale, type PageSize } from './sizes'
import type {
  CanvasElement,
  PlaceDisplay,
  SongDisplay,
  SongSource,
  GameDisplay,
  EmbedDisplay,
  MediaDisplay,
  WeatherDisplay,
  WorkoutDisplay,
  CanvasPage,
  ElementKind,
  FontKey,
  Frame,
  Pattern,
  ShapeKind,
} from './types'

/** Fallback dimensions for pages made before formats existed. */
export const PAGE_W = 1080
export const PAGE_H = 1350

export const MIN_SIZE = 24
export const MAX_ELEMENTS = 200

export const PAGE_BACKGROUNDS = [
  '#faf7f0',
  '#ffffff',
  '#f3e9dc',
  '#e8eef2',
  '#efe6f5',
  '#1c1a2e',
  '#12131a',
]

export const PATTERNS: Pattern[] = ['none', 'dots', 'grid', 'lines']

export const INK_COLORS = [
  '#1c1a2e',
  '#5b4636',
  '#8b2f4a',
  '#2f5d62',
  '#3b5bdb',
  '#b45309',
  '#ffffff',
]

export const FILL_COLORS = [
  '#f6c177',
  '#f2a1a1',
  '#a5c9c4',
  '#b8b3e6',
  '#f5e6a8',
  '#c9d8b6',
  '#1c1a2e',
  '#ffffff',
]

export const TAPE_COLORS = ['#f2c14e', '#e79a9a', '#9fc6c2', '#bdb2e3', '#e8e0cd']

export const FONTS: { key: FontKey; label: string; stack: string }[] = [
  { key: 'sans', label: 'Sans', stack: 'var(--font-geist-sans), system-ui, sans-serif' },
  { key: 'serif', label: 'Serif', stack: 'var(--font-playfair), Georgia, serif' },
  { key: 'hand', label: 'Hand', stack: 'var(--font-caveat), "Segoe Script", cursive' },
  { key: 'mono', label: 'Mono', stack: 'var(--font-geist-mono), ui-monospace, monospace' },
]

export function fontStack(key: FontKey): string {
  return (FONTS.find((f) => f.key === key) ?? FONTS[0]).stack
}

export const STICKER_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Feelings', emojis: ['❤️', '✨', '🔥', '🌟', '💫', '😄', '🥹', '😌', '🤍', '💛'] },
  { label: 'Outside', emojis: ['🌊', '⛰️', '🌲', '🌸', '🍂', '🌙', '☀️', '⛅', '🌈', '🐚'] },
  { label: 'Doing', emojis: ['📸', '🎧', '🎮', '📚', '☕', '🍜', '🚲', '✈️', '🎂', '🎬'] },
  { label: 'Marks', emojis: ['📌', '📎', '⭐', '✔️', '➡️', '❗', '💬', '🔖', '🗓️', '🧷'] },
]

export function emptyCanvas(size?: PageSize): CanvasPage {
  return {
    width: size?.width ?? PAGE_W,
    height: size?.height ?? PAGE_H,
    background: PAGE_BACKGROUNDS[0],
    pattern: 'none',
    elements: [],
  }
}

/** What a chosen track hands to a new song element. */
export interface SongSeed {
  display: SongDisplay
  title: string
  artist: string
  album: string
  playedAt: string
  source: SongSource
  linkUrl: string
  image: string
}

/** What a chosen game or achievement hands to a new game element. */
export interface GameSeed {
  display: GameDisplay
  name: string
  appId: number
  minutes: number | null
  minutesTotal: number | null
  url: string
  image: string
  achievement: string
  achievementNote: string
  unlockedAt: string
  rarity: number | null
}

/** What an activity hands to a new workout element. */
export interface WorkoutSeed {
  display: WorkoutDisplay
  name: string
  sport: string
  distance: number
  movingTime: number
  elevation: number
  startedAt: string
  polyline: string
  url: string
  unit: 'km' | 'mi'
}

/** What a weather lookup hands to a new weather element. */
export interface WeatherSeed {
  display: WeatherDisplay
  place: string
  date: string
  high: number | null
  low: number | null
  code: number
  precip: number | null
  unit: 'c' | 'f'
}

/** What a search result hands to a new shelf element. */
export interface MediaSeed {
  medium: Medium
  display: MediaDisplay
  title: string
  creator: string
  year: number | null
  detail: string
  rating: string
  url: string
  image: string
}

/** What a pasted address hands to a new embed element. */
export interface EmbedSeed {
  provider: EmbedProvider
  id: string
  path: EmbedPath
  start: number
  url: string
}

/** What a search result hands to a new place element. */
export interface PlaceSeed {
  display: PlaceDisplay
  name: string
  address: string
  mapsUrl: string
  centre: string
  zoom: number
  style: MapStyle
  mapImage: string
  qrImage: string
}

let seq = 0
function newId(): string {
  seq += 1
  return `el-${Date.now().toString(36)}-${seq.toString(36)}`
}

/**
 * Builds an element of the given kind, centred on the given page point.
 *
 * `pageWidth` scales the default sizes: the same photo should take up a
 * similar share of a Pocket page as it does of an A4 one.
 */
export function createElement(
  kind: ElementKind,
  at: { x: number; y: number },
  options: {
    emoji?: string
    photo?: string
    shape?: ShapeKind
    text?: string
    place?: PlaceSeed
    song?: SongSeed
    game?: GameSeed
    embed?: EmbedSeed
    media?: MediaSeed
    weather?: WeatherSeed
    workout?: WorkoutSeed
  } = {},
  pageWidth: number = PAGE_W
): CanvasElement {
  const base = { id: newId(), rotation: 0 }
  const k = elementScale(pageWidth)
  const centre = (rawW: number, rawH: number) => {
    const w = Math.round(rawW * k)
    const h = Math.round(rawH * k)
    return { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h }
  }

  switch (kind) {
    case 'text':
      return {
        ...base,
        ...centre(420, 90),
        kind: 'text',
        text: options.text ?? 'Double-click to write',
        fontSize: Math.round(44 * k),
        color: INK_COLORS[0],
        font: 'hand',
        align: 'left',
        bold: false,
        italic: false,
      }
    case 'photo':
      return {
        ...base,
        ...centre(420, 420),
        kind: 'photo',
        photo: options.photo ?? '',
        frame: 'rounded',
        caption: '',
      }
    case 'sticker':
      return { ...base, ...centre(140, 140), kind: 'sticker', emoji: options.emoji ?? '✨' }
    case 'shape': {
      const shape = options.shape ?? 'rect'
      const size = shape === 'line' ? { w: 360, h: 12 } : { w: 300, h: 300 }
      return { ...base, ...centre(size.w, size.h), kind: 'shape', shape, color: FILL_COLORS[0] }
    }
    case 'tape':
      return {
        ...base,
        ...centre(260, 64),
        kind: 'tape',
        color: TAPE_COLORS[0],
        rotation: -6,
      }
    case 'song': {
      const seed = options.song
      const display = seed?.display ?? 'card'
      // A card needs room for the words; bare art stays square.
      const size = display === 'card' ? { w: 420, h: 150 } : { w: 300, h: 300 }

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'song',
        display,
        title: seed?.title ?? '',
        artist: seed?.artist ?? '',
        album: seed?.album ?? '',
        playedAt: seed?.playedAt ?? '',
        source: seed?.source ?? 'manual',
        linkUrl: seed?.linkUrl ?? '',
        image: seed?.image ?? '',
      }
    }
    case 'game': {
      const seed = options.game
      const display = seed?.display ?? 'cover'
      // Box art is a tall 2:3; the others are wide little cards.
      const size =
        display === 'cover' ? { w: 260, h: 390 } : display === 'card' ? { w: 420, h: 160 } : { w: 400, h: 120 }

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'game',
        display,
        name: seed?.name ?? '',
        appId: seed?.appId ?? 0,
        minutes: seed?.minutes ?? null,
        minutesTotal: seed?.minutesTotal ?? null,
        url: seed?.url ?? '',
        image: seed?.image ?? '',
        achievement: seed?.achievement ?? '',
        achievementNote: seed?.achievementNote ?? '',
        unlockedAt: seed?.unlockedAt ?? '',
        rarity: seed?.rarity ?? null,
      }
    }
    case 'workout': {
      const seed = options.workout
      const display = seed?.display ?? 'route'
      // A route wants a square to be drawn in; the card lies on its side.
      const size = display === 'route' ? { w: 300, h: 300 } : { w: 420, h: 190 }

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'workout',
        display,
        name: seed?.name ?? '',
        sport: seed?.sport ?? '',
        distance: seed?.distance ?? 0,
        movingTime: seed?.movingTime ?? 0,
        elevation: seed?.elevation ?? 0,
        startedAt: seed?.startedAt ?? '',
        polyline: seed?.polyline ?? '',
        url: seed?.url ?? '',
        unit: seed?.unit ?? 'km',
        note: '',
      }
    }
    case 'weather': {
      const seed = options.weather
      const display = seed?.display ?? 'tag'
      // A tag is one line; the card has room for the words and the rain.
      const size = display === 'tag' ? { w: 300, h: 68 } : { w: 260, h: 190 }

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'weather',
        display,
        place: seed?.place ?? '',
        date: seed?.date ?? '',
        high: seed?.high ?? null,
        low: seed?.low ?? null,
        code: seed?.code ?? 0,
        precip: seed?.precip ?? null,
        unit: seed?.unit ?? 'c',
      }
    }
    case 'media': {
      const seed = options.media
      const display = seed?.display ?? 'cover'
      // Jackets and posters are all roughly 2:3; the card lies on its side
      // beside one.
      const size = display === 'cover' ? { w: 240, h: 360 } : { w: 430, h: 180 }

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'media',
        medium: seed?.medium ?? 'book',
        display,
        title: seed?.title ?? '',
        creator: seed?.creator ?? '',
        year: seed?.year ?? null,
        detail: seed?.detail ?? '',
        rating: seed?.rating ?? '',
        note: '',
        url: seed?.url ?? '',
        image: seed?.image ?? '',
      }
    }
    case 'embed': {
      const seed = options.embed
      const provider = seed?.provider ?? 'instagram'
      // Each service settles at a different shape: video is 16:9, a tweet is
      // a tall column, an Instagram post is nearly square with its caption.
      const size = defaultSize(provider)

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'embed',
        provider,
        display: 'captioned',
        mediaId: seed?.id ?? '',
        path: seed?.path ?? 'p',
        start: seed?.start ?? 0,
        url: seed?.url ?? '',
        note: '',
      }
    }
    case 'place': {
      const seed = options.place
      const display = seed?.display ?? 'pin'
      // A map wants room; a pin is a label; a code needs to stay square.
      const size =
        display === 'map' ? { w: 400, h: 440 } : display === 'qr' ? { w: 240, h: 290 } : { w: 360, h: 96 }

      return {
        ...base,
        ...centre(size.w, size.h),
        kind: 'place',
        display,
        name: seed?.name ?? '',
        address: seed?.address ?? '',
        mapsUrl: seed?.mapsUrl ?? '',
        centre: seed?.centre ?? '',
        zoom: seed?.zoom ?? 15,
        style: seed?.style ?? 'roadmap',
        mapImage: seed?.mapImage ?? '',
        qrImage: seed?.qrImage ?? '',
      }
    }
  }
}

/* ------------------------------------------------------------ validation -- */

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

const str = (value: unknown, fallback: string, maxLength: number): string =>
  typeof value === 'string' ? value.slice(0, maxLength) : fallback

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

/** Colours are user-pickable, so only accept plain hex. */
const colour = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback

/**
 * Only ever link out to Google Maps. The page renders these as real links, so
 * an arbitrary href — javascript:, data: — must not survive a round trip.
 */
const mapsUrl = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return ''
    const host = url.hostname.toLowerCase()
    const allowed =
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'goo.gl' ||
      host.endsWith('.goo.gl') ||
      host === 'maps.app.goo.gl'
    return allowed ? url.toString() : ''
  } catch {
    return ''
  }
}

/** Song stickers only ever link to a music service's own page for the track. */
const TRACK_HOSTS = ['spotify.com', 'apple.com']

const trackUrl = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return ''
    const host = url.hostname.toLowerCase()
    return TRACK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}

const minutesOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null

/** Game stickers only ever link to a Steam store page. */
const storeUrl = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return ''
    const host = url.hostname.toLowerCase()
    return host === 'steampowered.com' || host.endsWith('.steampowered.com') ? url.toString() : ''
  } catch {
    return ''
  }
}

/** Photo names must look like something the uploads folder produced. */
/**
 * Keeps a shelf link pointing at the service that found the thing, and at an
 * entry rather than wherever a stored string happens to say. Each address is
 * rebuilt from its id, so a tampered link can't survive a save.
 */
const shelfUrl = (value: unknown, medium: Medium): string => {
  if (typeof value !== 'string') return ''

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return ''
    const host = parsed.hostname.toLowerCase()

    if (medium === 'book') {
      if (host !== 'openlibrary.org') return ''
      return isWorkKey(parsed.pathname) ? `https://openlibrary.org${parsed.pathname}` : ''
    }

    if (medium === 'film') {
      if (host === 'www.imdb.com' || host === 'imdb.com') {
        const id = parsed.pathname.split('/').filter(Boolean)[1] ?? ''
        return isImdbId(id) ? `https://www.imdb.com/title/${id}/` : ''
      }

      // A film brought over from Letterboxd links back to your own entry for
      // it, which is more use than the IMDb page.
      if (host === 'letterboxd.com' || host === 'www.letterboxd.com') {
        const parts = parsed.pathname.split('/').filter(Boolean)
        const looksRight = parts.length >= 3 && parts[1] === 'film'
        return looksRight && parts.every((part) => /^[a-zA-Z0-9_-]+$/.test(part))
          ? `https://letterboxd.com/${parts.join('/')}/`
          : ''
      }

      return ''
    }

    return isAniListUrl(value) ? value : ''
  } catch {
    return ''
  }
}

/** Keeps a workout link pointing at the activity it claims to be. */
const activityUrl = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return ''
    const host = parsed.hostname.toLowerCase()
    if (host !== 'www.strava.com' && host !== 'strava.com') return ''

    const parts = parsed.pathname.split('/').filter(Boolean)
    return parts[0] === 'activities' && /^\d+$/.test(parts[1] ?? '')
      ? `https://www.strava.com/activities/${parts[1]}`
      : ''
  } catch {
    return ''
  }
}

const temperatureOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > -150 && value < 200
    ? Math.round(value * 10) / 10
    : null

const yearOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 2200
    ? Math.round(value)
    : null

const photoName = (value: unknown): string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]+\.(jpg|png|gif|webp|avif)$/.test(value) ? value : ''

function sanitizeElement(raw: unknown): CanvasElement | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>

  const base = {
    id: str(e.id, '', 64) || newId(),
    x: num(e.x, 0, -PAGE_W, PAGE_W * 2),
    y: num(e.y, 0, -PAGE_H, PAGE_H * 2),
    w: num(e.w, 100, MIN_SIZE, PAGE_W * 2),
    h: num(e.h, 100, MIN_SIZE, PAGE_H * 2),
    rotation: num(e.rotation, 0, -360, 360),
  }

  switch (e.kind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        text: str(e.text, '', 2000),
        fontSize: num(e.fontSize, 44, 8, 400),
        color: colour(e.color, INK_COLORS[0]),
        font: oneOf<FontKey>(e.font, ['sans', 'serif', 'mono', 'hand'], 'sans'),
        align: oneOf(e.align, ['left', 'center', 'right'] as const, 'left'),
        bold: e.bold === true,
        italic: e.italic === true,
      }
    case 'photo': {
      const photo = photoName(e.photo)
      if (!photo) return null
      return {
        ...base,
        kind: 'photo',
        photo,
        frame: oneOf<Frame>(e.frame, ['plain', 'rounded', 'circle', 'polaroid'], 'rounded'),
        caption: str(e.caption, '', 120),
      }
    }
    case 'sticker': {
      const emoji = str(e.emoji, '', 8)
      if (!emoji) return null
      return { ...base, kind: 'sticker', emoji }
    }
    case 'shape':
      return {
        ...base,
        kind: 'shape',
        shape: oneOf<ShapeKind>(e.shape, ['rect', 'ellipse', 'line'], 'rect'),
        color: colour(e.color, FILL_COLORS[0]),
      }
    case 'tape':
      return { ...base, kind: 'tape', color: colour(e.color, TAPE_COLORS[0]) }
    case 'song': {
      // Cover art is optional — one typed in by hand may not have any.
      const image = photoName(e.image)
      return {
        ...base,
        kind: 'song',
        display: oneOf<SongDisplay>(e.display, ['card', 'art'], 'card'),
        title: str(e.title, '', 300),
        artist: str(e.artist, '', 300),
        album: str(e.album, '', 300),
        playedAt: str(e.playedAt, '', 40),
        source: oneOf<SongSource>(e.source, ['spotify', 'itunes', 'manual'], 'manual'),
        // `spotifyUrl` is the old field name, read so nothing already on a page breaks.
        linkUrl: trackUrl(e.linkUrl ?? e.spotifyUrl),
        image,
      }
    }
    case 'game': {
      const image = photoName(e.image)
      if (!image) return null
      return {
        ...base,
        kind: 'game',
        display: oneOf<GameDisplay>(e.display, ['cover', 'card', 'achievement'], 'cover'),
        name: str(e.name, '', 200),
        appId: num(e.appId, 0, 0, 100_000_000),
        minutes: minutesOrNull(e.minutes),
        minutesTotal: minutesOrNull(e.minutesTotal),
        url: storeUrl(e.url),
        image,
        achievement: str(e.achievement, '', 200),
        achievementNote: str(e.achievementNote, '', 400),
        unlockedAt: str(e.unlockedAt, '', 40),
        rarity:
          typeof e.rarity === 'number' && Number.isFinite(e.rarity)
            ? Math.min(100, Math.max(0, e.rarity))
            : null,
      }
    }
    case 'workout': {
      return {
        ...base,
        kind: 'workout',
        display: oneOf<WorkoutDisplay>(e.display, ['route', 'card'], 'route'),
        name: str(e.name, '', 200),
        sport: str(e.sport, '', 40),
        // A hundred thousand kilometres is beyond any single outing.
        distance: num(e.distance, 0, 0, 100_000_000),
        movingTime: num(e.movingTime, 0, 0, 60 * 60 * 24 * 30),
        elevation: num(e.elevation, 0, 0, 100_000),
        startedAt: str(e.startedAt, '', 40),
        // Drawn straight into an SVG path, so anything that isn't a polyline
        // is dropped rather than corrected.
        polyline: isPolyline(e.polyline) ? e.polyline : '',
        url: activityUrl(e.url),
        unit: oneOf<'km' | 'mi'>(e.unit, ['km', 'mi'], 'km'),
        note: str(e.note, '', 300),
      }
    }
    case 'weather': {
      return {
        ...base,
        kind: 'weather',
        display: oneOf<WeatherDisplay>(e.display, ['tag', 'card'], 'tag'),
        place: str(e.place, '', 120),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? '')) ? String(e.date) : '',
        high: temperatureOrNull(e.high),
        low: temperatureOrNull(e.low),
        // WMO codes stop well short of 100; anything else means clear.
        code: num(e.code, 0, 0, 99),
        precip:
          typeof e.precip === 'number' && Number.isFinite(e.precip) && e.precip >= 0
            ? Math.min(e.precip, 2000)
            : null,
        unit: oneOf<'c' | 'f'>(e.unit, ['c', 'f'], 'c'),
      }
    }
    case 'media': {
      const medium: Medium = isMedium(e.medium) ? e.medium : 'book'
      return {
        ...base,
        kind: 'media',
        medium,
        display: oneOf<MediaDisplay>(e.display, ['cover', 'card'], 'cover'),
        title: str(e.title, '', 200),
        creator: str(e.creator, '', 200),
        year: yearOrNull(e.year),
        detail: str(e.detail, '', 40),
        // Kept as text, but only if it reads like a score.
        rating: /^\d{1,2}(\.\d)?$/.test(String(e.rating ?? '')) ? String(e.rating) : '',
        note: str(e.note, '', 300),
        url: shelfUrl(e.url, medium),
        // A cover is nice to have, not required: plenty of books have none,
        // and the card stands on its own without one.
        image: photoName(e.image),
      }
    }
    case 'embed': {
      const provider: EmbedProvider = isEmbedProvider(e.provider) ? e.provider : 'instagram'
      // Embeds made before there was more than one service kept the id under
      // its old name. Deliberately never `e.id`, which is the element's own.
      const mediaId = e.mediaId ?? (e as { shortcode?: unknown }).shortcode

      // The id goes straight into a frame address, so anything that isn't one
      // is dropped rather than corrected.
      if (!isEmbedId(provider, mediaId)) return null
      const path: EmbedPath = isEmbedPath(e.path) ? e.path : 'p'

      return {
        ...base,
        kind: 'embed',
        provider,
        display: oneOf<EmbedDisplay>(e.display, ['captioned', 'bare'], 'captioned'),
        mediaId,
        path,
        start: num(e.start, 0, 0, 86_400),
        // Rebuilt from the parts rather than trusted, so the link can only
        // ever point at the thing it claims to be.
        url: sourceUrl(provider, mediaId, path),
        note: str(e.note, '', 200),
      }
    }
    case 'place': {
      const display = oneOf<PlaceDisplay>(e.display, ['map', 'pin', 'qr'], 'pin')
      const mapImage = photoName(e.mapImage)
      const qrImage = photoName(e.qrImage)
      // Nothing to show if the picture this display needs never arrived.
      if (display === 'map' && !mapImage) return null
      if (display === 'qr' && !qrImage) return null

      return {
        ...base,
        kind: 'place',
        display,
        name: str(e.name, '', 200),
        address: str(e.address, '', 300),
        mapsUrl: mapsUrl(e.mapsUrl),
        centre: str(e.centre, '', 200),
        zoom: num(e.zoom, 15, 1, 20),
        style: oneOf<MapStyle>(e.style, MAP_STYLES, 'roadmap'),
        mapImage,
        qrImage,
      }
    }
    default:
      return null
  }
}

/** Turns untrusted JSON from the browser into a canvas we're happy to store. */
export function sanitizeCanvas(raw: unknown): CanvasPage {
  if (!raw || typeof raw !== 'object') return emptyCanvas()
  const page = raw as Record<string, unknown>
  const elements = Array.isArray(page.elements) ? page.elements : []

  return {
    width: num(page.width, PAGE_W, 100, 5000),
    height: num(page.height, PAGE_H, 100, 5000),
    background: colour(page.background, PAGE_BACKGROUNDS[0]),
    pattern: oneOf<Pattern>(page.pattern, PATTERNS, 'none'),
    elements: elements
      .slice(0, MAX_ELEMENTS)
      .map(sanitizeElement)
      .filter((e): e is CanvasElement => e !== null),
  }
}

/** Rough luminance test so patterns and guides stay visible on dark pages. */
export function isDarkPage(background: string): boolean {
  const hex = background.replace('#', '')
  if (hex.length < 6) return false
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

/**
 * CSS for the page's paper texture.
 *
 * Always returns both properties — including the 'none' case — so switching
 * patterns overwrites them rather than removing them. Pair it with
 * `backgroundColor`, never the `background` shorthand: mixing the two lets a
 * removed longhand fall back to whatever the shorthand set.
 */
export function patternStyle(pattern: Pattern, dark: boolean): CSSProperties {
  const ink = dark ? 'rgba(255,255,255,0.14)' : 'rgba(28,26,46,0.12)'
  switch (pattern) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(${ink} 2px, transparent 2px)`,
        backgroundSize: '40px 40px',
      }
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }
    case 'lines':
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px)`,
        backgroundSize: '100% 56px',
      }
    default:
      return { backgroundImage: 'none', backgroundSize: 'auto' }
  }
}
