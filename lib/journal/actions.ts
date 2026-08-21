'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isCloudBacked } from './store'
import { rotateShareToken, setSharing } from './store-cloud'
import {
  createEntry,
  createScrapbook,
  deleteEntry,
  deleteScrapbook,
  getEntry,
  removePhoto,
  saveCanvas,
  savePhoto,
  setEntryDate,
  updateEntry,
  updateScrapbook,
} from './store'
import { sanitizeCanvas } from './canvas'
import { sanitizeScrapbookInput } from './books'
import type { EntryInput, Photo } from './types'

function readInput(formData: FormData): EntryInput {
  const date = String(formData.get('date') ?? '')
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10),
    title: String(formData.get('title') ?? '').trim().slice(0, 200),
    body: String(formData.get('body') ?? '').trim().slice(0, 20000),
    mood: String(formData.get('mood') ?? '').slice(0, 8),
  }
}

async function readPhotos(formData: FormData): Promise<Photo[]> {
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File)
  const saved = await Promise.all(files.map((file) => savePhoto(file)))
  return saved.filter((p): p is Photo => p !== null)
}

export async function createEntryAction(formData: FormData) {
  const scrapbookId = String(formData.get('scrapbookId') ?? '')
  const entry = await createEntry(scrapbookId, readInput(formData), await readPhotos(formData))
  revalidatePath('/')
  revalidatePath(`/book/${scrapbookId}`)
  redirect(`/entry/${entry.id}`)
}

export async function updateEntryAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const entry = await updateEntry(id, readInput(formData), await readPhotos(formData))
  revalidatePath('/')
  if (entry) revalidatePath(`/book/${entry.scrapbookId}`)
  revalidatePath(`/entry/${id}`)
  redirect(`/entry/${id}`)
}

export async function deleteEntryAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const entry = await getEntry(id)
  await deleteEntry(id)
  revalidatePath('/')
  if (entry) {
    revalidatePath(`/book/${entry.scrapbookId}`)
    redirect(`/book/${entry.scrapbookId}`)
  }
  redirect('/')
}

/** Re-dates an entry — offered after importing photos taken on another day. */
export async function setEntryDateAction(id: string, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Bad date')
  const entry = await setEntryDate(id, date)
  revalidatePath('/')
  revalidatePath(`/entry/${id}`)
  if (entry) revalidatePath(`/book/${entry.scrapbookId}`)
}

/* ----------------------------------------------------------- scrapbooks -- */

export async function createScrapbookAction(formData: FormData) {
  const book = await createScrapbook(
    sanitizeScrapbookInput({
      title: formData.get('title'),
      subtitle: formData.get('subtitle'),
      color: formData.get('color'),
      emoji: formData.get('emoji'),
      pageSize: formData.get('pageSize'),
    })
  )
  revalidatePath('/')
  redirect(`/book/${book.id}`)
}

export async function updateScrapbookAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  await updateScrapbook(
    id,
    sanitizeScrapbookInput({
      title: formData.get('title'),
      subtitle: formData.get('subtitle'),
      color: formData.get('color'),
      emoji: formData.get('emoji'),
      pageSize: formData.get('pageSize'),
    })
  )
  revalidatePath('/')
  revalidatePath(`/book/${id}`)
  redirect(`/book/${id}`)
}

export async function deleteScrapbookAction(formData: FormData) {
  await deleteScrapbook(String(formData.get('id') ?? ''))
  revalidatePath('/')
  redirect('/')
}

/**
 * Called by the editor as you work. The canvas arrives as JSON from the
 * browser, so it goes through `sanitizeCanvas` before it is ever stored.
 */
export async function saveCanvasAction(id: string, json: string): Promise<{ savedAt: string }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Malformed canvas')
  }

  await saveCanvas(id, sanitizeCanvas(parsed))
  revalidatePath('/')
  revalidatePath(`/entry/${id}`)
  return { savedAt: new Date().toISOString() }
}

export async function removePhotoAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  await removePhoto(id, String(formData.get('photo') ?? ''))
  revalidatePath(`/entry/${id}`)
  redirect(`/entry/${id}/edit`)
}

/**
 * Turns sharing on or off for a scrapbook.
 *
 * Hosted only — a local journal has nobody to share with, so the control isn't
 * offered and this refuses if it is called anyway.
 */
export async function setSharingAction(formData: FormData) {
  if (!isCloudBacked()) throw new Error('Sharing needs the hosted version')

  const id = String(formData.get('id') ?? '')
  const on = String(formData.get('on') ?? '') === 'true'

  await setSharing(id, on)
  revalidatePath(`/book/${id}`)
}

/** Mints a new link, so every one handed out so far stops working. */
export async function rotateShareAction(formData: FormData) {
  if (!isCloudBacked()) throw new Error('Sharing needs the hosted version')

  const id = String(formData.get('id') ?? '')
  await rotateShareToken(id)
  revalidatePath(`/book/${id}`)
}
