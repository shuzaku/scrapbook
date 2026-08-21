import { NextResponse } from 'next/server'
import { isAssetUrl } from '@/lib/icloud/sharedalbum'
import { attachPhoto, savePhoto } from '@/lib/journal/store'

/** The wall-clock shape photo dates are stored in, e.g. 2024-04-05T17:44:00. */
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/**
 * Brings one picture out of a shared album and into the entry's tray.
 *
 * Fetched server-side: the addresses are signed and short-lived, and the
 * picture has to be stored locally anyway so the page keeps it. Caption and
 * date come from the album, since iCloud strips EXIF from these renditions.
 */
export async function POST(request: Request) {
  const { url, entryId, caption, takenAt } = (await request.json().catch(() => ({}))) as {
    url?: string
    entryId?: string
    caption?: string
    takenAt?: string
  }

  if (typeof url !== 'string' || !isAssetUrl(url)) {
    return NextResponse.json({ error: 'That is not an iCloud photo address' }, { status: 400 })
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`iCloud answered ${res.status}`)

    const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg'
    if (!type.startsWith('image/')) throw new Error('that was not an image')

    const bytes = Buffer.from(await res.arrayBuffer())
    const claimed = typeof takenAt === 'string' ? takenAt : ''
    const stored = await savePhoto(
      new File([new Uint8Array(bytes)], 'icloud', { type }),
      WALL_CLOCK.test(claimed) ? claimed : null
    )

    if (!stored) {
      return NextResponse.json(
        { error: 'Unsupported image — iCloud sent something the journal cannot store' },
        { status: 415 }
      )
    }

    const photo =
      typeof caption === 'string' && caption.trim()
        ? { ...stored, caption: caption.trim().slice(0, 120) }
        : stored

    if (typeof entryId === 'string' && entryId && !(await attachPhoto(entryId, photo))) {
      return NextResponse.json({ error: 'Unknown entry' }, { status: 404 })
    }

    return NextResponse.json({ photo })
  } catch (err) {
    console.error('[icloud] importing a photo failed', err)
    return NextResponse.json({ error: 'Could not fetch that photo' }, { status: 502 })
  }
}
