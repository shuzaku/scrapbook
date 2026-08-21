/**
 * Notebook formats.
 *
 * Pages are laid out in pixels, so each size is its real paper dimensions at
 * 150 DPI — enough resolution that a page reads crisply on screen and prints
 * respectably, while keeping the numbers close to a comfortable working scale.
 *
 * Pure data: safe to import from anywhere.
 */

export type PageSizeKey = 'pocket' | 'a6' | 'b6' | 'a5' | 'b5' | 'a4'

export const DPI = 150

export interface PageSize {
  key: PageSizeKey
  label: string
  /** Real dimensions, in inches. */
  inches: [number, number]
  width: number
  height: number
  blurb: string
}

function size(
  key: PageSizeKey,
  label: string,
  inches: [number, number],
  blurb: string
): PageSize {
  return {
    key,
    label,
    inches,
    width: Math.round(inches[0] * DPI),
    height: Math.round(inches[1] * DPI),
    blurb,
  }
}

export const PAGE_SIZES: PageSize[] = [
  size('pocket', 'Pocket / Field Notes', [3.5, 5.5], 'Quick lists, pocket carry, sudden ideas.'),
  size('a6', 'A6', [4.1, 5.8], 'Travel logs, small handwriting, easy bag carry.'),
  size('b6', 'B6', [4.9, 6.9], 'A middle ground — roomier than A6, still portable.'),
  size('a5', 'A5', [5.8, 8.3], 'The gold standard for daily diaries and bullet journals.'),
  size('b5', 'B5', [6.9, 9.8], 'Desk writing, creative spreads, large handwriting.'),
  size('a4', 'A4', [8.3, 11.7], 'Heavy desk use, big sketches, structural layouts.'),
]

export const DEFAULT_PAGE_SIZE: PageSizeKey = 'a5'

export function pageSize(key: PageSizeKey | string | undefined): PageSize {
  return PAGE_SIZES.find((s) => s.key === key) ?? PAGE_SIZES.find((s) => s.key === DEFAULT_PAGE_SIZE)!
}

/** "5.8 × 8.3 in" — for showing next to the name. */
export function sizeLabel(size: PageSize): string {
  return `${size.inches[0]} × ${size.inches[1]} in`
}

/**
 * How much to scale a new element by on this page.
 *
 * Element defaults are written for a page around 1080px wide; a Pocket page is
 * half that, so a photo dropped on one would swamp it without this.
 */
export function elementScale(pageWidth: number): number {
  return pageWidth / 1080
}
