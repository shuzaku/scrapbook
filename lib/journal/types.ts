import type { PageSizeKey } from './sizes'

export interface Photo {
  /** File name inside the uploads directory, e.g. "a1b2.jpg". */
  name: string
  caption: string | null
  /** When the photo was taken, if it said. ISO wall-clock, no timezone. */
  takenAt: string | null
}

/* ---------------------------------------------------------------- canvas -- */

export type FontKey = 'sans' | 'serif' | 'mono' | 'hand'
export type Frame = 'plain' | 'rounded' | 'circle' | 'polaroid'
export type ShapeKind = 'rect' | 'ellipse' | 'line'
export type Pattern = 'none' | 'dots' | 'grid' | 'lines'

interface BaseElement {
  id: string
  /** Top-left corner in page coordinates, before rotation. */
  x: number
  y: number
  w: number
  h: number
  /** Degrees, clockwise, about the element's centre. */
  rotation: number
}

export interface TextElement extends BaseElement {
  kind: 'text'
  text: string
  fontSize: number
  color: string
  font: FontKey
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

export interface PhotoElement extends BaseElement {
  kind: 'photo'
  /** File name in the uploads directory. */
  photo: string
  frame: Frame
  caption: string
}

export interface StickerElement extends BaseElement {
  kind: 'sticker'
  emoji: string
}

export interface ShapeElement extends BaseElement {
  kind: 'shape'
  shape: ShapeKind
  color: string
}

export interface TapeElement extends BaseElement {
  kind: 'tape'
  color: string
}

/** How a place shows up on the page. */
export type PlaceDisplay = 'map' | 'pin' | 'qr'

export interface PlaceElement extends BaseElement {
  kind: 'place'
  display: PlaceDisplay
  /** The label on the sticker. Starts as the place's name, then yours. */
  name: string
  address: string
  /** Where clicking the sticker — or scanning its code — goes. */
  mapsUrl: string
  /** What the static map is centred on: "lat,lng" or the place text. */
  centre: string
  zoom: number
  style: 'roadmap' | 'terrain' | 'satellite' | 'hybrid'
  /** Stored images, fetched the first time each display is used. */
  mapImage: string
  qrImage: string
}

/** A card with the art and words, or the bare album cover. */
export type SongDisplay = 'card' | 'art'

/** Which service the track came from — the sticker's mark has to match its link. */
export type SongSource = 'spotify' | 'itunes' | 'manual'

export interface SongElement extends BaseElement {
  kind: 'song'
  display: SongDisplay
  title: string
  artist: string
  album: string
  /** ISO timestamp of when it was played. Spotify only. */
  playedAt: string
  source: SongSource
  /** Where the sticker links to — the track on whichever service it came from. */
  linkUrl: string
  /** The stored cover art, kept as served. */
  image: string
}

/** Box art, a "played this" card, or an unlocked achievement. */
export type GameDisplay = 'cover' | 'card' | 'achievement'

export interface GameElement extends BaseElement {
  kind: 'game'
  display: GameDisplay
  /** The game itself. */
  name: string
  appId: number
  /** Minutes played in the fortnight, when it came from your library. */
  minutes: number | null
  /** Minutes played all told — the number worth putting on a page. */
  minutesTotal: number | null
  /** The store page — where the sticker links to. */
  url: string
  /** Box art, header art, or the achievement's icon, stored locally. */
  image: string
  /** Achievement stickers only. */
  achievement: string
  achievementNote: string
  unlockedAt: string
  /** Share of players with this achievement, when Steam publishes it. */
  rarity: number | null
}

/** The route on its own, or a card with the numbers beside it. */
export type WorkoutDisplay = 'route' | 'card'

/**
 * Something you went out and did.
 *
 * The route is kept as Strava's encoded polyline and drawn as vector art at
 * render time — no map tiles, no key, and it stays sharp however big the
 * sticker gets.
 */
export interface WorkoutElement extends BaseElement {
  kind: 'workout'
  display: WorkoutDisplay
  /** What you called it on Strava. */
  name: string
  /** Run, Ride, Walk — already spaced for reading. */
  sport: string
  /** Metres. */
  distance: number
  /** Seconds moving. */
  movingTime: number
  /** Metres climbed. */
  elevation: number
  /** ISO wall-clock, no timezone. */
  startedAt: string
  /** Google-encoded polyline, or empty for a treadmill. */
  polyline: string
  /** The activity on Strava. */
  url: string
  unit: 'km' | 'mi'
  /** A line of your own. */
  note: string
}

/** A line, or a little card. */
export type WeatherDisplay = 'tag' | 'card'

/**
 * What the weather was on the day, at a place.
 *
 * Every entry already carries a date, so this only needs somewhere to look
 * up — after which it's a fact about that day, kept like any other.
 */
export interface WeatherElement extends BaseElement {
  kind: 'weather'
  display: WeatherDisplay
  /** "Kyoto, Japan" — as it goes on the page. */
  place: string
  /** The day itself, as yyyy-mm-dd. */
  date: string
  high: number | null
  low: number | null
  /** WMO weather code; the sticker turns it into words and a picture. */
  code: number
  /** Millimetres, or inches alongside Fahrenheit. */
  precip: number | null
  unit: 'c' | 'f'
}

/** The bare cover, or a card with the words beside it. */
export type MediaDisplay = 'cover' | 'card'

/**
 * A book, film, anime or manga.
 *
 * One element for all four: they differ only in which service found them and
 * what the line of detail says, so a single sticker serves them all.
 */
export interface MediaElement extends BaseElement {
  kind: 'media'
  medium: 'book' | 'film' | 'anime' | 'manga'
  display: MediaDisplay
  title: string
  /** Author, director or studio, whichever applies. */
  creator: string
  year: number | null
  /** One line: "205 pages", "125 min", "26 episodes". */
  detail: string
  /** Out of ten, as text — empty when the service had no score. */
  rating: string
  /** A line of your own — what you thought, when you read or watched it. */
  note: string
  /** Where the sticker links to, on whichever service found it. */
  url: string
  /** The cover, downloaded and kept locally like every other picture. */
  image: string
}

/** How much of the post to show. */
export type EmbedDisplay = 'captioned' | 'bare'

/**
 * A live Instagram post, framed on the page.
 *
 * The odd one out: every other element keeps its picture locally, while this
 * one is a window onto Instagram. Only public posts render, and the frame goes
 * blank if the post is taken down.
 */
export interface EmbedElement extends BaseElement {
  kind: 'embed'
  /** Which service it came from. */
  provider: 'instagram' | 'youtube' | 'twitter'
  display: EmbedDisplay
  /**
   * Shortcode, video id or tweet id — all the frame address needs.
   *
   * Deliberately not `id`: every element already has one of those, and the
   * two would silently overwrite each other.
   */
  mediaId: string
  /** Instagram only: it keeps three paths for the same object. */
  path: 'p' | 'reel' | 'tv'
  /** YouTube only: seconds in to start from. */
  start: number
  /** Where the thing itself lives, for the link out. */
  url: string
  /** A note of your own, shown under the frame. */
  note: string
}

export type CanvasElement =
  | TextElement
  | PhotoElement
  | StickerElement
  | ShapeElement
  | TapeElement
  | PlaceElement
  | SongElement
  | GameElement
  | EmbedElement
  | MediaElement
  | WeatherElement
  | WorkoutElement

export type ElementKind = CanvasElement['kind']

/**
 * A partial update to any element. Fields shared across kinds (position, size,
 * colour) have the same type everywhere, so one patch shape covers them all.
 */
export type ElementPatch = Partial<Omit<TextElement, 'kind' | 'id'>> &
  Partial<Omit<PhotoElement, 'kind' | 'id'>> &
  Partial<Omit<StickerElement, 'kind' | 'id'>> &
  Partial<Omit<ShapeElement, 'kind' | 'id'>> &
  Partial<Omit<TapeElement, 'kind' | 'id'>> &
  // `display` means different things on a place and a song, so intersecting
  // them would leave it impossible to set. It's spelled out instead.
  Partial<Omit<PlaceElement, 'kind' | 'id' | 'display'>> &
  Partial<Omit<SongElement, 'kind' | 'id' | 'display'>> &
  Partial<Omit<GameElement, 'kind' | 'id' | 'display'>> &
  Partial<Omit<EmbedElement, 'kind' | 'id' | 'display'>> &
  Partial<Omit<MediaElement, 'kind' | 'id' | 'display'>> &
  Partial<Omit<WeatherElement, 'kind' | 'id' | 'display'>> &
  Partial<Omit<WorkoutElement, 'kind' | 'id' | 'display'>> & {
    display?:
      | PlaceDisplay
      | SongDisplay
      | GameDisplay
      | EmbedDisplay
      | MediaDisplay
      | WeatherDisplay
      | WorkoutDisplay
  }

export interface CanvasPage {
  width: number
  height: number
  background: string
  pattern: Pattern
  /** Painted back to front — last element is on top. */
  elements: CanvasElement[]
}

/* ---------------------------------------------------------------- entries -- */

/**
 * A book of entries. Every entry belongs to exactly one.
 */
export interface Scrapbook {
  id: string
  title: string
  /** The notebook format its pages are made at. */
  pageSize: PageSizeKey
  /** A line under the title on the shelf. May be empty. */
  subtitle: string
  cover: {
    color: string
    emoji: string
  }
  createdAt: string
  updatedAt: string
}

export interface ScrapbookInput {
  title: string
  subtitle: string
  color: string
  emoji: string
  pageSize: PageSizeKey
}

export interface Entry {
  id: string
  /** The scrapbook this entry lives in. */
  scrapbookId: string
  /** Calendar day the entry is about, as yyyy-MM-dd. */
  date: string
  title: string
  body: string
  /** A single emoji, or empty string for none. */
  mood: string
  photos: Photo[]
  /** The laid-out scrapbook page. Null until the entry has been designed. */
  canvas: CanvasPage | null
  createdAt: string
  updatedAt: string
}

export interface EntryInput {
  date: string
  title: string
  body: string
  mood: string
}

export const MOODS = ['😄', '🙂', '😌', '😐', '😕', '😢', '😤', '🤩', '🥱', '❤️'] as const
