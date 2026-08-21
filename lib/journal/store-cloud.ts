/**
 * The hosted backing: Postgres for the writing, Supabase Storage for the
 * pictures, scoped to whoever is signed in.
 *
 * Two things are deliberately different from the local backing:
 *
 * Writes are targeted. The local store reads the whole collection, changes one
 * thing and writes it all back — safe with one process and a lost update
 * waiting to happen with two. Here every change is a single statement against
 * a single row.
 *
 * Nothing is scoped by hand. Every query runs as the signed-in person through
 * row level security, so a missing `where owner = …` is not a data leak — it
 * simply returns nothing. `owner` is set on insert because the column is not
 * null, not because it is doing the guarding.
 */
import { createClient } from '@/lib/supabase/server'
import { sanitizeCanvas } from './canvas'
import { DEFAULT_COVER } from './books'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSizeKey } from './sizes'
import type { CanvasPage, Entry, EntryInput, Photo, Scrapbook, ScrapbookInput } from './types'

const BUCKET = 'photos'

/** Extensions the store accepts, matched to what the browser sends. */
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

async function client() {
  return createClient()
}

/** Who is asking. Null when nobody is signed in, which means no data. */
async function whoami(): Promise<string | null> {
  const supabase = await client()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/* ------------------------------------------------------------- row shapes -- */

interface ScrapbookRow {
  id: string
  title: string
  subtitle: string
  page_size: string
  cover_color: string
  cover_emoji: string
  created_at: string
  updated_at: string
}

interface EntryRow {
  id: string
  scrapbook_id: string
  date: string
  title: string
  body: string
  mood: string
  photos: unknown
  canvas: unknown
  created_at: string
  updated_at: string
}

function toScrapbook(row: ScrapbookRow): Scrapbook {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    // A format this build doesn't know about falls back rather than breaking
    // the shelf.
    pageSize: (PAGE_SIZES.some((size) => size.key === row.page_size)
      ? row.page_size
      : DEFAULT_PAGE_SIZE) as PageSizeKey,
    cover: {
      color: row.cover_color || DEFAULT_COVER.color,
      emoji: row.cover_emoji || DEFAULT_COVER.emoji,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toPhotos(value: unknown): Photo[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const photo = entry as { name?: unknown; caption?: unknown; takenAt?: unknown }
    if (typeof photo.name !== 'string') return []

    return [
      {
        name: photo.name,
        caption: typeof photo.caption === 'string' ? photo.caption : null,
        takenAt: typeof photo.takenAt === 'string' ? photo.takenAt : null,
      },
    ]
  })
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    scrapbookId: row.scrapbook_id,
    date: row.date,
    title: row.title,
    body: row.body,
    mood: row.mood,
    photos: toPhotos(row.photos),
    // Checked on the way out as well as in, so a row written by an older
    // version reads the way it will once it is next saved.
    canvas: row.canvas ? sanitizeCanvas(row.canvas) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/* ------------------------------------------------------------ scrapbooks -- */

export async function listScrapbooks(): Promise<Scrapbook[]> {
  const supabase = await client()
  const { data, error } = await supabase
    .from('scrapbooks')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`listing scrapbooks failed: ${error.message}`)
  return (data ?? []).map(toScrapbook)
}

export async function getScrapbook(id: string): Promise<Scrapbook | null> {
  const supabase = await client()
  const { data } = await supabase.from('scrapbooks').select('*').eq('id', id).maybeSingle()
  return data ? toScrapbook(data) : null
}

export async function createScrapbook(input: ScrapbookInput): Promise<Scrapbook> {
  const owner = await whoami()
  if (!owner) throw new Error('not signed in')

  const supabase = await client()
  const { data, error } = await supabase
    .from('scrapbooks')
    .insert({
      owner,
      title: input.title,
      subtitle: input.subtitle,
      page_size: input.pageSize,
      cover_color: input.color,
      cover_emoji: input.emoji,
    })
    .select()
    .single()

  if (error) throw new Error(`creating a scrapbook failed: ${error.message}`)
  return toScrapbook(data)
}

export async function updateScrapbook(
  id: string,
  input: ScrapbookInput
): Promise<Scrapbook | null> {
  const supabase = await client()
  const { data } = await supabase
    .from('scrapbooks')
    .update({
      title: input.title,
      subtitle: input.subtitle,
      page_size: input.pageSize,
      cover_color: input.color,
      cover_emoji: input.emoji,
    })
    .eq('id', id)
    .select()
    .maybeSingle()

  return data ? toScrapbook(data) : null
}

export async function deleteScrapbook(id: string): Promise<void> {
  const supabase = await client()

  // The pictures have to go before the rows do, since the rows are what says
  // which pictures there were. Entries cascade from the scrapbook.
  const { data: entries } = await supabase.from('entries').select('photos').eq('scrapbook_id', id)
  const names = (entries ?? []).flatMap((row) => toPhotos(row.photos).map((photo) => photo.name))
  if (names.length > 0) await removeFiles(names)

  const { error } = await supabase.from('scrapbooks').delete().eq('id', id)
  if (error) throw new Error(`deleting a scrapbook failed: ${error.message}`)
}

/* --------------------------------------------------------------- entries -- */

export async function countEntries(): Promise<Record<string, number>> {
  const supabase = await client()
  const { data } = await supabase.from('entries').select('scrapbook_id')

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.scrapbook_id] = (counts[row.scrapbook_id] ?? 0) + 1
  }
  return counts
}

export async function listEntries(scrapbookId: string): Promise<Entry[]> {
  const supabase = await client()
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('scrapbook_id', scrapbookId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listing entries failed: ${error.message}`)
  return (data ?? []).map(toEntry)
}

export async function getEntry(id: string): Promise<Entry | null> {
  const supabase = await client()
  const { data } = await supabase.from('entries').select('*').eq('id', id).maybeSingle()
  return data ? toEntry(data) : null
}

export async function createEntry(
  scrapbookId: string,
  input: EntryInput,
  photos: Photo[] = []
): Promise<Entry> {
  const owner = await whoami()
  if (!owner) throw new Error('not signed in')

  const supabase = await client()
  const { data, error } = await supabase
    .from('entries')
    .insert({
      owner,
      scrapbook_id: scrapbookId,
      date: input.date,
      title: input.title,
      body: input.body,
      mood: input.mood,
      photos,
    })
    .select()
    .single()

  // The composite key means a scrapbook belonging to someone else has nothing
  // to reference, so this is where that attempt lands.
  if (error) throw new Error(`creating an entry failed: ${error.message}`)
  return toEntry(data)
}

export async function updateEntry(
  id: string,
  input: EntryInput,
  addedPhotos: Photo[] = []
): Promise<Entry | null> {
  const supabase = await client()

  const patch: Record<string, unknown> = {
    date: input.date,
    title: input.title,
    body: input.body,
    mood: input.mood,
  }

  // Photos are appended rather than replaced, so an edit that adds one does
  // not drop what was already there.
  if (addedPhotos.length > 0) {
    const { data: entry } = await supabase
      .from('entries')
      .select('photos')
      .eq('id', id)
      .maybeSingle()
    if (!entry) return null
    patch.photos = [...toPhotos(entry.photos), ...addedPhotos]
  }

  const { data } = await supabase.from('entries').update(patch).eq('id', id).select().maybeSingle()
  return data ? toEntry(data) : null
}

export async function deleteEntry(id: string): Promise<void> {
  const supabase = await client()

  const { data: entry } = await supabase.from('entries').select('photos').eq('id', id).maybeSingle()
  if (entry) {
    const names = toPhotos(entry.photos).map((photo) => photo.name)
    if (names.length > 0) await removeFiles(names)
  }

  await supabase.from('entries').delete().eq('id', id)
}

export async function setEntryDate(id: string, date: string): Promise<Entry | null> {
  const supabase = await client()
  const { data } = await supabase
    .from('entries')
    .update({ date })
    .eq('id', id)
    .select()
    .maybeSingle()

  return data ? toEntry(data) : null
}

export async function saveCanvas(id: string, canvas: CanvasPage): Promise<Entry | null> {
  const supabase = await client()

  // What the browser sent is never stored as it arrived.
  const clean = sanitizeCanvas(canvas)

  const { data: before } = await supabase
    .from('entries')
    .select('canvas')
    .eq('id', id)
    .maybeSingle()
  if (!before) return null

  const { data: saved, error } = await supabase
    .from('entries')
    .update({ canvas: clean })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw new Error(`saving the page failed: ${error.message}`)
  if (!saved) return null

  // Pictures the page has stopped pointing at, and which are not in the tray,
  // have nothing left to keep them.
  const dropped = unreferenced(before.canvas, clean)
  if (dropped.length > 0) {
    const { data: entry } = await supabase
      .from('entries')
      .select('photos')
      .eq('id', id)
      .maybeSingle()
    const kept = new Set(toPhotos(entry?.photos).map((photo) => photo.name))
    const removable = dropped.filter((name) => !kept.has(name))
    if (removable.length > 0) await removeFiles(removable)
  }

  return toEntry(saved)
}

/** Picture names a canvas refers to — cover art, map tiles, and the like. */
function canvasImages(canvas: unknown): string[] {
  const elements = (canvas as { elements?: unknown })?.elements
  if (!Array.isArray(elements)) return []

  return elements.flatMap((value) => {
    const element = value as { kind?: unknown; image?: unknown; mapImage?: unknown; qrImage?: unknown }
    if (element.kind === 'place') {
      return [element.mapImage, element.qrImage].filter(
        (name): name is string => typeof name === 'string' && !!name
      )
    }
    if (element.kind === 'song' || element.kind === 'game' || element.kind === 'media') {
      return typeof element.image === 'string' && element.image ? [element.image] : []
    }
    return []
  })
}

function unreferenced(before: unknown, after: unknown): string[] {
  const kept = new Set(canvasImages(after))
  return canvasImages(before).filter((name) => !kept.has(name))
}

/* ---------------------------------------------------------------- photos -- */

/** Where a person's pictures live: one folder each, which the policies check. */
async function folder(): Promise<string> {
  const owner = await whoami()
  if (!owner) throw new Error('not signed in')
  return owner
}

export async function savePhoto(file: File, takenAt?: string | null): Promise<Photo | null> {
  if (!file || file.size === 0 || file.size > MAX_PHOTO_BYTES) return null

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) return null

  const supabase = await client()
  const name = `${crypto.randomUUID()}${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${await folder()}/${name}`, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(`storing a photo failed: ${error.message}`)

  // The date is whatever the caller knew. Reading it out of the file needs
  // sharp, which is why that only happens on the local backing.
  return { name, caption: null, takenAt: takenAt ?? null }
}

/**
 * Stores a picture under a name it already has.
 *
 * Only used when carrying a local journal across: a laid-out page refers to
 * its pictures by name, so a migration that renamed them would arrive with
 * every photo element blank. Not part of the shared backing shape — nothing
 * else has any business choosing a file name.
 */
export async function savePhotoAs(name: string, file: File): Promise<boolean> {
  if (!/^[a-zA-Z0-9-]+\.(jpg|png|gif|webp|avif)$/.test(name)) return false
  if (!file || file.size === 0 || file.size > MAX_PHOTO_BYTES) return false

  const supabase = await client()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${await folder()}/${name}`, file, {
      contentType: file.type,
      // A second run of the migration should land on the same picture, not
      // fail because it is already there.
      upsert: true,
    })

  if (error) {
    console.error('[store] carrying a picture across failed', error.message)
    return false
  }
  return true
}

export async function attachPhoto(id: string, photo: Photo): Promise<boolean> {
  const supabase = await client()
  const { data: entry } = await supabase.from('entries').select('photos').eq('id', id).maybeSingle()
  if (!entry) return false

  const { error } = await supabase
    .from('entries')
    .update({ photos: [...toPhotos(entry.photos), photo] })
    .eq('id', id)

  return !error
}

export async function removePhoto(entryId: string, photoName: string): Promise<void> {
  const supabase = await client()
  const { data: entry } = await supabase
    .from('entries')
    .select('photos')
    .eq('id', entryId)
    .maybeSingle()
  if (!entry) return

  const photos = toPhotos(entry.photos)
  const kept = photos.filter((photo) => photo.name !== photoName)
  if (kept.length === photos.length) return

  const { error } = await supabase.from('entries').update({ photos: kept }).eq('id', entryId)
  if (error) return

  await removeFiles([photoName])
}

export async function readPhoto(name: string): Promise<{ body: Buffer; type: string } | null> {
  // The same shape check the local backing uses, so a name can never climb out
  // of the folder it belongs to.
  if (!/^[a-zA-Z0-9-]+\.(jpg|png|gif|webp|avif)$/.test(name)) return null

  const supabase = await client()
  const { data, error } = await supabase.storage.from(BUCKET).download(`${await folder()}/${name}`)
  if (error || !data) return null

  const ext = name.slice(name.lastIndexOf('.'))
  const type = Object.entries(EXT_BY_TYPE).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream'
  return { body: Buffer.from(await data.arrayBuffer()), type }
}

async function removeFiles(names: string[]): Promise<void> {
  if (names.length === 0) return

  const supabase = await client()
  const owner = await folder()
  // A failure here leaves a file nobody points at, which costs storage and
  // nothing else — never worth failing the request the person actually made.
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(names.map((name) => `${owner}/${name}`))

  if (error) console.error('[store] removing pictures failed', error.message)
}

/* ---------------------------------------------------------------- sharing -- */

export interface ShareState {
  on: boolean
  /** The link's token, once there is one. */
  token: string | null
}

/**
 * Whether a scrapbook is shared, and under which token.
 *
 * Not part of the shared backing shape: a local journal has nobody to share
 * with, so callers check isCloudBacked() before asking.
 */
export async function shareState(id: string): Promise<ShareState | null> {
  const supabase = await client()
  const { data } = await supabase
    .from('scrapbooks')
    .select('share_token, is_public')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null
  return { on: !!data.is_public, token: data.share_token ?? null }
}

/**
 * Turns sharing on or off.
 *
 * The token is minted once and kept when sharing is switched off, so turning
 * it back on doesn't break a link someone already has. Use rotateShareToken to
 * deliberately break them.
 */
export async function setSharing(id: string, on: boolean): Promise<ShareState | null> {
  const supabase = await client()
  const current = await shareState(id)
  if (!current) return null

  const patch: Record<string, unknown> = { is_public: on }
  // 24 bytes of randomness: long enough that a link cannot be guessed, which
  // is the only thing standing between a share and the open web.
  if (on && !current.token) patch.share_token = crypto.randomUUID().replace(/-/g, '')

  const { data } = await supabase
    .from('scrapbooks')
    .update(patch)
    .eq('id', id)
    .select('share_token, is_public')
    .maybeSingle()

  if (!data) return null
  return { on: !!data.is_public, token: data.share_token ?? null }
}

/** Mints a new token, so every link handed out so far stops working. */
export async function rotateShareToken(id: string): Promise<ShareState | null> {
  const supabase = await client()
  const { data } = await supabase
    .from('scrapbooks')
    .update({ share_token: crypto.randomUUID().replace(/-/g, '') })
    .eq('id', id)
    .select('share_token, is_public')
    .maybeSingle()

  if (!data) return null
  return { on: !!data.is_public, token: data.share_token ?? null }
}

/* ------------------------------------------------------------ maintenance -- */

/**
 * Nothing to sweep: a picture in the cloud belongs to a row, and goes when the
 * row does. Kept so both backings answer the same calls.
 */
export async function sweepOrphans(_minAgeMs = 60 * 60 * 1000): Promise<number> {
  return 0
}

export { SUPPORTED_IMAGE_TYPES, unsupportedReason } from './store-local'
