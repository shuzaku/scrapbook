import { NextResponse } from 'next/server'
import { SuggestError, suggestForEntry } from '@/lib/ai/suggest'
import { getEntry } from '@/lib/journal/store'

/**
 * Suggestions for one entry.
 *
 * Only ever runs when someone asks for it — the entry's words leave the
 * machine on this call and nowhere else in the app.
 */
export async function POST(request: Request) {
  const { entryId } = (await request.json().catch(() => ({}))) as { entryId?: string }

  if (typeof entryId !== 'string' || !entryId) {
    return NextResponse.json({ error: 'No entry given' }, { status: 400 })
  }

  const entry = await getEntry(entryId)
  if (!entry) return NextResponse.json({ error: 'Unknown entry' }, { status: 404 })

  try {
    return NextResponse.json({ suggestions: await suggestForEntry(entry) })
  } catch (err) {
    const known = err instanceof SuggestError
    if (!known) console.error('[ai] suggesting failed', err)
    return NextResponse.json(
      { error: known ? err.message : 'Could not think of anything' },
      { status: known ? err.status : 502 }
    )
  }
}
