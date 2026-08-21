import { NextResponse } from 'next/server'
import { isAllowedArtUrl } from '@/lib/music/art'
import { attachPhoto, savePhoto } from '@/lib/journal/store'

/**
 * Stores a piece of cover art so the page owns it.
 *
 * Only the music services' own image hosts are fetched from, and the art is
 * saved exactly as served — Spotify's terms require that, and it's the right
 * thing for Apple's too.
 */
export async function POST(request: Request) {
  const { artUrl, entryId, caption } = (await request.json().catch(() => ({}))) as {
    artUrl?: string
    /**
     * Given for pictures that become ordinary photos — a game screenshot —
     * so they join the entry's tray and can be re-used and cleaned up like
     * any other. Sticker artwork belongs to its sticker and is left out.
     */
    entryId?: string
    /** Kept with the photo, so an imported post arrives with its words. */
    caption?: string
  }

  if (typeof artUrl !== 'string' || !isAllowedArtUrl(artUrl)) {
    return NextResponse.json({ error: 'That is not a cover image we fetch from' }, { status: 400 })
  }

  try {
    const res = await fetch(artUrl)
    if (!res.ok) throw new Error(`cover art fetch failed (${res.status})`)

    const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg'
    if (!type.startsWith('image/')) throw new Error('cover art was not an image')

    const bytes = Buffer.from(await res.arrayBuffer())
    const stored = await savePhoto(new File([new Uint8Array(bytes)], 'cover', { type }))
    if (!stored) return NextResponse.json({ error: 'Could not store the cover' }, { status: 500 })

    const saved =
      typeof caption === 'string' && caption.trim()
        ? { ...stored, caption: caption.trim().slice(0, 120) }
        : stored

    if (typeof entryId === 'string' && entryId) await attachPhoto(entryId, saved)

    return NextResponse.json({ image: saved.name, photo: saved })
  } catch (err) {
    console.error('[music] storing cover art failed', err)
    return NextResponse.json({ error: 'Could not fetch that cover art' }, { status: 502 })
  }
}
