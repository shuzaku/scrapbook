/**
 * Local, zero-configuration storage for the journal.
 *
 * Everything lives in a gitignored `.data/` folder next to the project so the
 * app runs with no API keys, no database and no network. The exported
 * functions are the only way the rest of the app touches storage — swapping
 * this file for Supabase (or anything else) later means reimplementing these
 * signatures, nothing more.
 *
 * Server-only: it uses `node:fs` and must never be imported from a Client
 * Component.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { LEGACY_BOOK_TITLE, DEFAULT_COVER } from './books'
import { sanitizeCanvas } from './canvas'
import { DEFAULT_PAGE_SIZE } from './sizes'
import { takenAtFromImage } from '@/lib/photos/exif'
import type { CanvasPage, Entry, EntryInput, Photo, Scrapbook, ScrapbookInput } from './types'

const DATA_DIR = process.env.JOURNAL_DATA_DIR ?? path.join(process.cwd(), '.data')
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json')
const BOOKS_FILE = path.join(DATA_DIR, 'scrapbooks.json')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

/** Image types the journal can store, for callers that want to explain a refusal. */
export const SUPPORTED_IMAGE_TYPES = Object.keys(EXT_BY_TYPE)

/** Why savePhoto would reject this file, or null if it wouldn't. */
export function unsupportedReason(file: File): string | null {
  if (!file || file.size === 0) return 'the file was empty'
  if (file.size > MAX_PHOTO_BYTES) {
    return `it is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the ${MAX_PHOTO_BYTES / 1024 / 1024}MB limit`
  }
  if (!EXT_BY_TYPE[file.type]) return `${file.type || 'its file type'} isn't supported`
  return null
}

async function readAll(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(ENTRIES_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Entries written before pages, or photos saved before capture dates,
    // are missing those keys.
    return (parsed as Entry[]).map((entry) => ({
      ...entry,
      // Run through the same check as on the way in, so a page written by an
      // older version reads the way it will once it is next saved. Without
      // this a page renders from raw stored JSON, and a field that has since
      // been renamed comes out blank.
      canvas: entry.canvas ? sanitizeCanvas(entry.canvas) : null,
      photos: (entry.photos ?? []).map((photo) => ({ ...photo, takenAt: photo.takenAt ?? null })),
    }))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

async function writeAll(entries: Entry[]): Promise<void> {
  await writeJson(ENTRIES_FILE, entries)
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  // Write-then-rename so a crash mid-write can't truncate the file.
  const tmp = `${file}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    // Don't leave the half-written file behind if the swap fails.
    await fs.unlink(tmp).catch(() => {})
    throw err
  }
}

/* --------------------------------------------------------------- books -- */

async function readBooks(): Promise<Scrapbook[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(BOOKS_FILE, 'utf8'))
    if (!Array.isArray(parsed)) return []
    // Books made before formats existed are treated as the default size.
    return (parsed as Scrapbook[]).map((book) => ({
      ...book,
      pageSize: book.pageSize ?? DEFAULT_PAGE_SIZE,
    }))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

function newBook(input: ScrapbookInput): Scrapbook {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    title: input.title,
    subtitle: input.subtitle,
    pageSize: input.pageSize,
    cover: { color: input.color, emoji: input.emoji },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Entries used to live in a single flat list. The first time we read after
 * that change, gather any book-less entries into one scrapbook so nothing
 * written before this feature disappears. With no orphans it writes nothing.
 */
async function migrateOnce(): Promise<void> {
  const [books, entries] = await Promise.all([readBooks(), readAll()])
  const orphans = entries.filter((entry) => !entry.scrapbookId)
  if (orphans.length === 0) return

  const home =
    books[0] ??
    newBook({
      title: LEGACY_BOOK_TITLE,
      subtitle: '',
      color: DEFAULT_COVER.color,
      emoji: DEFAULT_COVER.emoji,
      pageSize: DEFAULT_PAGE_SIZE,
    })

  await writeJson(BOOKS_FILE, books.length > 0 ? books : [home])
  await writeAll(
    entries.map((entry) => (entry.scrapbookId ? entry : { ...entry, scrapbookId: home.id }))
  )
}

let migration: Promise<void> | null = null

/**
 * Runs the migration at most once per process. A page that loads books and
 * entry counts in parallel would otherwise run it twice, and each run mints a
 * different book id — leaving entries pointing at a book that no longer exists.
 */
function ensureMigrated(): Promise<void> {
  migration ??= migrateOnce().catch((err) => {
    migration = null
    throw err
  })
  return migration
}

async function loadAll(): Promise<{ books: Scrapbook[]; entries: Entry[] }> {
  await ensureMigrated()
  const [books, entries] = await Promise.all([readBooks(), readAll()])
  return { books, entries }
}

export async function listScrapbooks(): Promise<Scrapbook[]> {
  const { books } = await loadAll()
  return [...books].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getScrapbook(id: string): Promise<Scrapbook | null> {
  const { books } = await loadAll()
  return books.find((book) => book.id === id) ?? null
}

export async function createScrapbook(input: ScrapbookInput): Promise<Scrapbook> {
  const { books } = await loadAll()
  const book = newBook(input)
  await writeJson(BOOKS_FILE, [...books, book])
  return book
}

export async function updateScrapbook(
  id: string,
  input: ScrapbookInput
): Promise<Scrapbook | null> {
  const { books } = await loadAll()
  const index = books.findIndex((book) => book.id === id)
  if (index === -1) return null

  books[index] = {
    ...books[index],
    title: input.title,
    subtitle: input.subtitle,
    pageSize: input.pageSize,
    cover: { color: input.color, emoji: input.emoji },
    updatedAt: new Date().toISOString(),
  }
  await writeJson(BOOKS_FILE, books)
  return books[index]
}

/**
 * Image files a page owns that aren't in the photo tray — maps and QR codes
 * are fetched straight onto the canvas, so they'd otherwise be left behind.
 */
function canvasImages(entry: Entry): string[] {
  return (entry.canvas?.elements ?? []).flatMap((el) => {
    if (el.kind === 'place') return [el.mapImage, el.qrImage].filter(Boolean)
    if (el.kind === 'song' || el.kind === 'game' || el.kind === 'media')
      return el.image ? [el.image] : []
    return []
  })
}

/**
 * Removes upload files nothing points at any more.
 *
 * Maps and codes are fetched before the page that uses them is saved, so one
 * abandoned mid-edit is referenced by nothing and can't be swept by the page
 * itself. Only files older than `minAgeMs` are touched, so an image an open
 * editor has just fetched is never pulled out from under it.
 */
export async function sweepOrphans(minAgeMs = 60 * 60 * 1000): Promise<number> {
  const { entries } = await loadAll()

  const referenced = new Set<string>()
  for (const entry of entries) {
    for (const photo of entry.photos) referenced.add(photo.name)
    for (const name of canvasImages(entry)) referenced.add(name)
  }

  let names: string[]
  try {
    names = await fs.readdir(UPLOADS_DIR)
  } catch {
    return 0
  }

  const cutoff = Date.now() - minAgeMs
  let removed = 0

  await Promise.all(
    names
      .filter((name) => !referenced.has(name))
      .map(async (name) => {
        const file = path.join(UPLOADS_DIR, name)
        try {
          const stat = await fs.stat(file)
          if (stat.mtimeMs > cutoff) return
          await fs.unlink(file)
          removed += 1
        } catch {
          // Raced with something else removing it; nothing to do.
        }
      })
  )

  return removed
}

/** Deletes a scrapbook along with every entry and photo inside it. */
export async function deleteScrapbook(id: string): Promise<void> {
  const { books, entries } = await loadAll()
  if (!books.some((book) => book.id === id)) return

  const doomed = entries.filter((entry) => entry.scrapbookId === id)
  await writeJson(
    BOOKS_FILE,
    books.filter((book) => book.id !== id)
  )
  await writeAll(entries.filter((entry) => entry.scrapbookId !== id))
  await Promise.all(
    doomed.flatMap((entry) => [
      ...entry.photos.map((photo) => deletePhotoFile(photo.name)),
      ...canvasImages(entry).map(deletePhotoFile),
    ])
  )
  await sweepOrphans()
}

/** Marks a book as touched so the shelf orders by recent activity. */
async function touchBook(id: string): Promise<void> {
  const books = await readBooks()
  const index = books.findIndex((book) => book.id === id)
  if (index === -1) return
  books[index] = { ...books[index], updatedAt: new Date().toISOString() }
  await writeJson(BOOKS_FILE, books)
}

export async function countEntries(): Promise<Record<string, number>> {
  const { entries } = await loadAll()
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    counts[entry.scrapbookId] = (counts[entry.scrapbookId] ?? 0) + 1
  }
  return counts
}

/** Newest day first; ties broken by most recently written. */
function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  )
}

/** Entries in one scrapbook, newest day first. */
export async function listEntries(scrapbookId: string): Promise<Entry[]> {
  const { entries } = await loadAll()
  return sortEntries(entries.filter((entry) => entry.scrapbookId === scrapbookId))
}

export async function getEntry(id: string): Promise<Entry | null> {
  const entries = await readAll()
  return entries.find((e) => e.id === id) ?? null
}

export async function createEntry(
  scrapbookId: string,
  input: EntryInput,
  photos: Photo[] = []
): Promise<Entry> {
  const now = new Date().toISOString()
  const entry: Entry = {
    id: randomUUID(),
    scrapbookId,
    ...input,
    photos,
    canvas: null,
    createdAt: now,
    updatedAt: now,
  }
  const { entries } = await loadAll()
  await writeAll([...entries, entry])
  await touchBook(scrapbookId)
  return entry
}

export async function updateEntry(
  id: string,
  input: EntryInput,
  addedPhotos: Photo[] = []
): Promise<Entry | null> {
  const entries = await readAll()
  const index = entries.findIndex((e) => e.id === id)
  if (index === -1) return null

  const updated: Entry = {
    ...entries[index],
    ...input,
    photos: [...entries[index].photos, ...addedPhotos],
    updatedAt: new Date().toISOString(),
  }
  entries[index] = updated
  await writeAll(entries)
  return updated
}

export async function deleteEntry(id: string): Promise<void> {
  const entries = await readAll()
  const entry = entries.find((e) => e.id === id)
  if (!entry) return

  await writeAll(entries.filter((e) => e.id !== id))
  await Promise.all([
    ...entry.photos.map((photo) => deletePhotoFile(photo.name)),
    ...canvasImages(entry).map(deletePhotoFile),
  ])
  await sweepOrphans()
}

export async function removePhoto(entryId: string, photoName: string): Promise<void> {
  const entries = await readAll()
  const index = entries.findIndex((e) => e.id === entryId)
  if (index === -1) return

  const entry = entries[index]
  entries[index] = {
    ...entry,
    photos: entry.photos.filter((p) => p.name !== photoName),
    // A photo that's gone can't stay pasted on the page.
    canvas: entry.canvas
      ? {
          ...entry.canvas,
          elements: entry.canvas.elements.filter(
            (el) => el.kind !== 'photo' || el.photo !== photoName
          ),
        }
      : null,
    updatedAt: new Date().toISOString(),
  }
  await writeAll(entries)
  await deletePhotoFile(photoName)
}

/** Replaces an entry's laid-out page. */
export async function saveCanvas(id: string, canvas: CanvasPage): Promise<Entry | null> {
  const { entries } = await loadAll()
  const index = entries.findIndex((e) => e.id === id)
  if (index === -1) return null

  const before = canvasImages(entries[index])
  entries[index] = { ...entries[index], canvas, updatedAt: new Date().toISOString() }
  await writeAll(entries)

  // Maps, codes and covers belong to the page alone, so any the new version no
  // longer mentions — a deleted sticker, or the old map after a zoom change —
  // are now unreachable and can go. Tray photos are never in this set.
  const after = new Set(canvasImages(entries[index]))
  await Promise.all(before.filter((name) => !after.has(name)).map(deletePhotoFile))

  return entries[index]
}

/** Re-dates an entry, e.g. to match the photos that were just imported. */
export async function setEntryDate(id: string, date: string): Promise<Entry | null> {
  const { entries } = await loadAll()
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1) return null

  entries[index] = { ...entries[index], date, updatedAt: new Date().toISOString() }
  await writeAll(entries)
  return entries[index]
}

/** Adds an uploaded photo to an entry's tray without touching its page. */
export async function attachPhoto(id: string, photo: Photo): Promise<boolean> {
  const entries = await readAll()
  const index = entries.findIndex((e) => e.id === id)
  if (index === -1) return false

  entries[index] = {
    ...entries[index],
    photos: [...entries[index].photos, photo],
    updatedAt: new Date().toISOString(),
  }
  await writeAll(entries)
  return true
}

/**
 * Saves an uploaded image and returns its stored reference, or null if
 * unusable. `takenAt` overrides what the file's own EXIF claims — Google hands
 * us a capture time directly, and it survives their re-encoding.
 */
export async function savePhoto(file: File, takenAt?: string | null): Promise<Photo | null> {
  if (!file || file.size === 0) return null
  if (file.size > MAX_PHOTO_BYTES) return null

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) return null

  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  const name = `${randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(UPLOADS_DIR, name), buffer)

  return {
    name,
    caption: null,
    takenAt: takenAt ?? (await takenAtFromImage(buffer)),
  }
}

/** Resolves a stored photo to bytes, refusing anything that escapes the uploads dir. */
export async function readPhoto(name: string): Promise<{ body: Buffer; type: string } | null> {
  if (!/^[a-zA-Z0-9-]+\.(jpg|png|gif|webp|avif)$/.test(name)) return null

  const filePath = path.join(UPLOADS_DIR, name)
  if (path.dirname(path.resolve(filePath)) !== path.resolve(UPLOADS_DIR)) return null

  try {
    const body = await fs.readFile(filePath)
    const ext = path.extname(name)
    const type =
      Object.entries(EXT_BY_TYPE).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream'
    return { body, type }
  } catch {
    return null
  }
}

async function deletePhotoFile(name: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOADS_DIR, name))
  } catch {
    // Already gone — nothing to clean up.
  }
}
