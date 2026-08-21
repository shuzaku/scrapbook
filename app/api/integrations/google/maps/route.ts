import { NextResponse } from 'next/server'
import {
  MAP_STYLES,
  MapsError,
  clampZoom,
  fetchStaticMap,
  isMapsConfigured,
  makeQrCode,
} from '@/lib/google/maps'
import { savePhoto } from '@/lib/journal/store'
import type { MapStyle } from '@/lib/google/maps-shared'

/** Only ever encode a link to Google's own maps into a sticker. */
function safeMapsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    const host = url.hostname.toLowerCase()
    const ok =
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'goo.gl' ||
      host.endsWith('.goo.gl')
    return ok ? url.toString() : null
  } catch {
    return null
  }
}

async function store(bytes: Buffer, name: string) {
  return savePhoto(new File([new Uint8Array(bytes)], name, { type: 'image/png' }))
}

/**
 * Draws a place: either a static map centred on it, or a scannable code
 * pointing at it. Both are stored as images so the page owns them outright.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    kind?: string
    centre?: string
    zoom?: number
    style?: string
    url?: string
  }

  if (body.kind === 'qr') {
    // A code needs no key at all — it's generated here.
    const url = safeMapsUrl(body.url)
    if (!url) {
      return NextResponse.json({ error: 'That is not a Google Maps link' }, { status: 400 })
    }
    const saved = await store(await makeQrCode(url), 'qr.png')
    if (!saved) return NextResponse.json({ error: 'Could not store the code' }, { status: 500 })
    return NextResponse.json({ image: saved.name })
  }

  if (!isMapsConfigured()) {
    return NextResponse.json(
      { error: 'Google Maps isn’t set up yet — add GOOGLE_MAPS_API_KEY.' },
      { status: 501 }
    )
  }

  const centre = String(body.centre ?? '').trim().slice(0, 200)
  if (!centre) {
    return NextResponse.json({ error: 'Nowhere to centre the map on' }, { status: 400 })
  }

  const zoom = clampZoom(Number(body.zoom ?? 15))
  const style = (MAP_STYLES as string[]).includes(String(body.style))
    ? (body.style as MapStyle)
    : 'roadmap'

  try {
    const saved = await store(await fetchStaticMap(centre, zoom, style), 'map.png')
    if (!saved) {
      return NextResponse.json({ error: 'Could not store the map image' }, { status: 500 })
    }
    return NextResponse.json({ image: saved.name, zoom, style })
  } catch (err) {
    console.error('[maps] fetching a static map failed', err)
    if (err instanceof MapsError) {
      return NextResponse.json({ error: err.message }, { status: err.status === 501 ? 501 : 502 })
    }
    return NextResponse.json({ error: 'Could not fetch that map' }, { status: 502 })
  }
}
