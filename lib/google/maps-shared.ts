/**
 * Map vocabulary that both sides of the wire need.
 *
 * Deliberately free of server-only imports — `maps.ts` pulls in the QR
 * encoder and talks to Google, so a Client Component must import from here.
 */

export type MapStyle = 'roadmap' | 'terrain' | 'satellite' | 'hybrid'

export const MAP_STYLES: MapStyle[] = ['roadmap', 'terrain', 'satellite', 'hybrid']

export const MIN_ZOOM = 1
export const MAX_ZOOM = 20

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 13
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)))
}

/** A Maps link for a plain search term, when there's no exact place to pin. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export interface PlaceResult {
  /** Google's place id, when the lookup came from the Places API. */
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  /** Where clicking the sticker, or scanning its code, goes. */
  mapsUrl: string
}
