/**
 * One shape for everything you can put on a shelf.
 *
 * Books, films, anime and manga come from three different services with three
 * different vocabularies. They're flattened here so the panel, the element and
 * the sticker only ever deal with one kind of thing: a title, whoever made it,
 * a year, one line of detail, and a cover.
 */

export type Medium = 'book' | 'film' | 'anime' | 'manga'

export const MEDIA: { key: Medium; label: string; placeholder: string }[] = [
  { key: 'book', label: 'Books', placeholder: 'Title or author' },
  { key: 'film', label: 'Films', placeholder: 'Film title' },
  { key: 'anime', label: 'Anime', placeholder: 'Anime title' },
  { key: 'manga', label: 'Manga', placeholder: 'Manga title' },
]

export function isMedium(value: unknown): value is Medium {
  return MEDIA.some((entry) => entry.key === value)
}

export interface MediaResult {
  /** Unique within a result list — the service's own id. */
  key: string
  medium: Medium
  title: string
  /** Author, director, or studio, depending on what it is. */
  creator: string
  year: number | null
  /** One line: "205 pages", "125 min", "26 episodes". */
  detail: string
  /** Out of ten, as text, or empty when the service has no score. */
  rating: string
  /** Where the sticker links to. */
  url: string
  coverUrl: string | null
}

export class MediaSearchError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'MediaSearchError'
  }
}
