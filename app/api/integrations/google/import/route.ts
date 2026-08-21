import { NextResponse } from 'next/server'
import { deleteSession, downloadItem, getSession, listPickedItems } from '@/lib/google/picker'
import { pickerErrorResponse } from '@/lib/google/errors'
import { getAccessToken } from '@/lib/google/tokens'
import { attachPhoto, savePhoto, unsupportedReason } from '@/lib/journal/store'
import type { Photo } from '@/lib/journal/types'

/** Photos brought in per pick, to bound both the wait and the disk use. */
const MAX_IMPORT = 25

/**
 * Polled by the editor while the picker is open. Returns `{ ready: false }`
 * until the person has finished choosing, then downloads what they picked into
 * the entry's photo tray.
 */
export async function POST(request: Request) {
  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json({ error: 'Not connected to Google Photos' }, { status: 401 })
  }

  const { sessionId, entryId } = (await request.json().catch(() => ({}))) as {
    sessionId?: string
    entryId?: string
  }
  if (!sessionId || !entryId) {
    return NextResponse.json({ error: 'sessionId and entryId are required' }, { status: 400 })
  }

  try {
    const session = await getSession(token, sessionId)
    if (!session.mediaItemsSet) {
      return NextResponse.json({ ready: false, pollInterval: session.pollInterval })
    }

    const picked = await listPickedItems(token, sessionId, MAX_IMPORT)
    const photos: Photo[] = []
    const failures: { name: string; reason: string }[] = []

    for (const item of picked) {
      try {
        const file = await downloadItem(token, item)

        // Same gate as a manual upload — but say which gate it hit, so a
        // failed import can be acted on instead of guessed at.
        const refusal = unsupportedReason(file)
        if (refusal) {
          failures.push({ name: item.filename, reason: refusal })
          continue
        }

        const photo = await savePhoto(file, item.createTime)
        if (!photo) {
          failures.push({ name: item.filename, reason: 'saving it to disk failed' })
        } else if (!(await attachPhoto(entryId, photo))) {
          failures.push({ name: item.filename, reason: 'that entry no longer exists' })
        } else {
          photos.push(photo)
        }
      } catch (err) {
        console.error('[google] importing an item failed', err)
        failures.push({
          name: item.filename,
          reason: err instanceof Error ? err.message : 'download failed',
        })
      }
    }

    // Google asks that sessions be cleaned up rather than left to expire.
    await deleteSession(token, sessionId).catch(() => {})

    return NextResponse.json({ ready: true, photos, picked: picked.length, failures })
  } catch (err) {
    console.error('[google] import failed', err)
    return pickerErrorResponse(err)
  }
}
