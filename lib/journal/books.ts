/**
 * Cover vocabulary for scrapbooks. Pure data — safe to import anywhere.
 */
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './sizes'
import type { PageSizeKey } from './sizes'
import type { ScrapbookInput } from './types'

export const COVER_COLORS = [
  '#8b2f4a',
  '#2f5d62',
  '#3b5bdb',
  '#b45309',
  '#5b4636',
  '#4c1d95',
  '#1c1a2e',
  '#c2410c',
]

export const COVER_EMOJIS = [
  '📖',
  '🌊',
  '⛰️',
  '🌸',
  '🎞️',
  '🎧',
  '✈️',
  '🏡',
  '🎂',
  '🐈',
  '☕',
  '⭐',
]

export const DEFAULT_COVER = { color: COVER_COLORS[0], emoji: COVER_EMOJIS[0] }

/** Name used when older, book-less entries are migrated into one. */
export const LEGACY_BOOK_TITLE = 'My scrapbook'

/** Normalises a submitted form into something we're happy to store. */
export function sanitizeScrapbookInput(input: {
  title?: unknown
  subtitle?: unknown
  color?: unknown
  emoji?: unknown
  pageSize?: unknown
}): ScrapbookInput {
  const title = String(input.title ?? '').trim().slice(0, 120)
  const color = String(input.color ?? '')
  const emoji = String(input.emoji ?? '')

  const requested = String(input.pageSize ?? '')
  const pageSize = (PAGE_SIZES.some((s) => s.key === requested)
    ? requested
    : DEFAULT_PAGE_SIZE) as PageSizeKey

  return {
    title: title || 'Untitled scrapbook',
    subtitle: String(input.subtitle ?? '').trim().slice(0, 200),
    color: COVER_COLORS.includes(color) ? color : DEFAULT_COVER.color,
    emoji: COVER_EMOJIS.includes(emoji) ? emoji : DEFAULT_COVER.emoji,
    pageSize,
  }
}
