/**
 * Places on pages.
 *
 * Looking a place up uses the Places API (New); drawing it uses the Maps
 * Static API; linking to it uses the `googleMapsUri` Google hands back. Every
 * call happens on the server, and anything drawn is stored as a plain image —
 * so the key never reaches the browser and a finished page needs no Google
 * access to be read.
 */
import QRCode from 'qrcode'
import { clampZoom, mapsSearchUrl, type MapStyle, type PlaceResult } from './maps-shared'

export { MAP_STYLES, MIN_ZOOM, MAX_ZOOM, clampZoom, mapsSearchUrl } from './maps-shared'
export type { MapStyle, PlaceResult } from './maps-shared'

const STATIC_MAP = 'https://maps.googleapis.com/maps/api/staticmap'
const TEXT_SEARCH = 'https://places.googleapis.com/v1/places:searchText'

/** 640 is the Static API's cap; scale=2 returns it at twice the density. */
const TILE = 640
const SCALE = 2

export function mapsApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key || key.startsWith('your_')) return null
  return key
}

export function isMapsConfigured(): boolean {
  return mapsApiKey() !== null
}

export class MapsError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'MapsError'
  }
}

/* -------------------------------------------------------------- lookups -- */

interface RawPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  googleMapsUri?: string
}

/**
 * Finds places by name — "the pizza place on Bedford", "Vík campsite".
 *
 * If the Places API isn't enabled on the project, this falls back to treating
 * the text as-is, so stickers still work with only the Static API switched on.
 */
export async function searchPlaces(
  query: string
): Promise<{ results: PlaceResult[]; exact: boolean }> {
  const key = mapsApiKey()
  if (!key) throw new MapsError('Google Maps is not configured', 501)

  const fallback = {
    results: [
      { id: '', name: query, address: '', lat: null, lng: null, mapsUrl: mapsSearchUrl(query) },
    ],
    exact: false,
  }

  let res: Response
  try {
    res = await fetch(TEXT_SEARCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 8 }),
    })
  } catch {
    return fallback
  }

  // A disabled or unauthorised Places API shouldn't sink the whole feature.
  if (res.status === 403 || res.status === 400 || res.status === 404) return fallback
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    throw new MapsError(detail || `Place search failed (${res.status})`, res.status)
  }

  const data = (await res.json()) as { places?: RawPlace[] }
  const results = (data.places ?? []).flatMap((place): PlaceResult[] => {
    const name = place.displayName?.text
    if (!name) return []
    const address = place.formattedAddress ?? ''
    return [
      {
        id: place.id ?? '',
        name,
        address,
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        mapsUrl: place.googleMapsUri || mapsSearchUrl(`${name} ${address}`.trim()),
      },
    ]
  })

  return results.length > 0 ? { results, exact: true } : fallback
}

/* --------------------------------------------------------------- images -- */

/** A map centred on a place, as PNG bytes. */
export async function fetchStaticMap(
  centre: string,
  zoom: number,
  style: MapStyle
): Promise<Buffer> {
  const key = mapsApiKey()
  if (!key) throw new MapsError('Google Maps is not configured', 501)

  const params = new URLSearchParams({
    center: centre,
    zoom: String(clampZoom(zoom)),
    size: `${TILE}x${TILE}`,
    scale: String(SCALE),
    maptype: style,
    markers: `color:0x8b2f4a|${centre}`,
    key,
  })

  const res = await fetch(`${STATIC_MAP}?${params}`)

  if (!res.ok) {
    // The Static API explains refusals in the body, and in a header for some
    // errors — both are worth passing on rather than a bare status.
    const detail = (res.headers.get('x-staticmap-api-warning') ?? (await res.text())).slice(0, 300)
    throw new MapsError(detail || `Maps request failed (${res.status})`, res.status)
  }

  const type = res.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) {
    throw new MapsError('Google returned something that was not an image', 502)
  }

  return Buffer.from(await res.arrayBuffer())
}

/**
 * A scannable code for a place, as PNG bytes. Generated locally — no key, no
 * request — so a QR sticker works even with nothing configured.
 */
export async function makeQrCode(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 512,
    margin: 1,
    color: { dark: '#1c1a2e', light: '#ffffff' },
  })
}
