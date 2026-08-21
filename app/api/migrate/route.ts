import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCloudBacked } from '@/lib/journal/store'
import * as local from '@/lib/journal/store-local'
import * as cloud from '@/lib/journal/store-cloud'

/**
 * Moves a local journal into the signed-in account, once.
 *
 * The local `.data/` folder is left exactly as it was — this copies, it does
 * not move. If something goes wrong halfway, the original is still the
 * original, and running it again is safe: anything already carried across is
 * skipped by title and date rather than duplicated.
 */
export async function POST() {
  if (!isCloudBacked()) {
    return NextResponse.json(
      { error: 'No cloud to migrate into — set the Supabase credentials first' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const books = await local.listScrapbooks()
  if (books.length === 0) {
    return NextResponse.json({ error: 'Nothing on this machine to move' }, { status: 404 })
  }

  const already = await cloud.listScrapbooks()
  const carried = { scrapbooks: 0, entries: 0, photos: 0, skipped: 0 }
  const trouble: string[] = []

  for (const book of books) {
    // A second run shouldn't make a second copy.
    const existing = already.find((one) => one.title === book.title)
    const target =
      existing ??
      (await cloud.createScrapbook({
        title: book.title,
        subtitle: book.subtitle,
        color: book.cover.color,
        emoji: book.cover.emoji,
        pageSize: book.pageSize,
      }))
    if (!existing) carried.scrapbooks += 1

    const theirs = existing ? await cloud.listEntries(target.id) : []
    const seen = new Set(theirs.map((entry) => `${entry.date}|${entry.title}`))

    for (const entry of await local.listEntries(book.id)) {
      if (seen.has(`${entry.date}|${entry.title}`)) {
        carried.skipped += 1
        continue
      }

      // Pictures first: the entry's tray points at them by name, and the names
      // have to survive the move for the page to still find them.
      const photos = []
      for (const photo of entry.photos) {
        const file = await local.readPhoto(photo.name)
        if (!file) {
          trouble.push(`missing picture ${photo.name}`)
          continue
        }

        const uploaded = await cloud.savePhotoAs(
          photo.name,
          new File([new Uint8Array(file.body)], photo.name, { type: file.type })
        )
        if (!uploaded) {
          trouble.push(`could not store ${photo.name}`)
          continue
        }

        photos.push(photo)
        carried.photos += 1
      }

      const made = await cloud.createEntry(
        target.id,
        { date: entry.date, title: entry.title, body: entry.body, mood: entry.mood },
        photos
      )
      if (entry.canvas) await cloud.saveCanvas(made.id, entry.canvas)
      carried.entries += 1
    }
  }

  return NextResponse.json({
    ...carried,
    trouble,
    note: 'Your local .data folder is untouched. Check everything arrived before removing it.',
  })
}
