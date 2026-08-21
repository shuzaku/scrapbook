/**
 * Storage for the journal — one seam, two backings.
 *
 * Without Supabase credentials everything lives in a gitignored `.data/`
 * folder, which is what lets the app run with no accounts, no database and no
 * network. With them, the same calls go to Postgres and Supabase Storage,
 * scoped to whoever is signed in.
 *
 * The rest of the app only sees the functions below, so which backing is in
 * use is not its business. Nothing outside `store-local` and `store-cloud`
 * touches a filesystem or a database client.
 *
 * Server-only: never import this from a Client Component.
 */
import { isSupabaseConfigured } from '@/lib/supabase/server'
import * as local from './store-local'
import * as cloud from './store-cloud'

/**
 * The local backing is the reference shape.
 *
 * Typing the cloud module as the same thing is what keeps the two honest: if
 * one grows a function, or changes what it takes or returns, this line stops
 * compiling rather than the mismatch surfacing as a runtime failure in
 * whichever deployment happens to use the other one.
 */
type Backend = typeof local
const cloudBackend: Backend = cloud

/**
 * Which backing to use.
 *
 * Read per call rather than captured once: the app is expected to start
 * without credentials and be given them later, and a module-level snapshot
 * would keep writing to disk after that.
 */
function backend(): Backend {
  return isSupabaseConfigured() ? cloudBackend : local
}

/** True when entries are kept in the cloud rather than on this machine. */
export function isCloudBacked(): boolean {
  return isSupabaseConfigured()
}

/* Shared constants — the same limits apply whichever backing is in use. */
export { MAX_PHOTO_BYTES, SUPPORTED_IMAGE_TYPES, unsupportedReason } from './store-local'

/* ------------------------------------------------------------ scrapbooks -- */

export const listScrapbooks: Backend['listScrapbooks'] = (...args) =>
  backend().listScrapbooks(...args)

export const getScrapbook: Backend['getScrapbook'] = (...args) => backend().getScrapbook(...args)

export const createScrapbook: Backend['createScrapbook'] = (...args) =>
  backend().createScrapbook(...args)

export const updateScrapbook: Backend['updateScrapbook'] = (...args) =>
  backend().updateScrapbook(...args)

export const deleteScrapbook: Backend['deleteScrapbook'] = (...args) =>
  backend().deleteScrapbook(...args)

/* --------------------------------------------------------------- entries -- */

export const countEntries: Backend['countEntries'] = (...args) => backend().countEntries(...args)

export const listEntries: Backend['listEntries'] = (...args) => backend().listEntries(...args)

export const getEntry: Backend['getEntry'] = (...args) => backend().getEntry(...args)

export const createEntry: Backend['createEntry'] = (...args) => backend().createEntry(...args)

export const updateEntry: Backend['updateEntry'] = (...args) => backend().updateEntry(...args)

export const deleteEntry: Backend['deleteEntry'] = (...args) => backend().deleteEntry(...args)

export const setEntryDate: Backend['setEntryDate'] = (...args) => backend().setEntryDate(...args)

export const saveCanvas: Backend['saveCanvas'] = (...args) => backend().saveCanvas(...args)

/* ---------------------------------------------------------------- photos -- */

export const savePhoto: Backend['savePhoto'] = (...args) => backend().savePhoto(...args)

export const attachPhoto: Backend['attachPhoto'] = (...args) => backend().attachPhoto(...args)

export const removePhoto: Backend['removePhoto'] = (...args) => backend().removePhoto(...args)

export const readPhoto: Backend['readPhoto'] = (...args) => backend().readPhoto(...args)

/* ----------------------------------------------------------- maintenance -- */

/**
 * Deletes stored pictures nothing points at any more.
 *
 * Only does anything on the local backing — in the cloud a picture belongs to
 * a row and goes when the row does.
 */
export const sweepOrphans: Backend['sweepOrphans'] = (...args) => backend().sweepOrphans(...args)
