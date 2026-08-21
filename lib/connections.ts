/**
 * Connected accounts — one seam, two backings, the same as the journal itself.
 *
 * Without Supabase credentials a connection is a record in a local file, which
 * is right for one person on one machine. With them it belongs to whoever made
 * it, so two people signed into the same deployment never share a Spotify
 * account between them.
 */
import { isSupabaseConfigured } from '@/lib/supabase/server'
import * as local from './connections/local'
import * as cloud from './connections/cloud'

/**
 * The local backing is the reference shape; typing the cloud one as the same
 * thing is what stops the two drifting apart unnoticed.
 */
type Backend = typeof local
const cloudBackend: Backend = cloud

function backend(): Backend {
  return isSupabaseConfigured() ? cloudBackend : local
}

export type { ConnectionStatus, Provider } from './connections/types'

export const getConnection: Backend['getConnection'] = (...args) =>
  backend().getConnection(...args)

export const saveConnection: Backend['saveConnection'] = (...args) =>
  backend().saveConnection(...args)

export const saveAccountConnection: Backend['saveAccountConnection'] = (...args) =>
  backend().saveAccountConnection(...args)

export const clearConnection: Backend['clearConnection'] = (...args) =>
  backend().clearConnection(...args)

export const connectionStatus: Backend['connectionStatus'] = (...args) =>
  backend().connectionStatus(...args)

export const refreshTokenFor: Backend['refreshTokenFor'] = (...args) =>
  backend().refreshTokenFor(...args)

export const accountIdFor: Backend['accountIdFor'] = (...args) => backend().accountIdFor(...args)

export const liveAccessToken: Backend['liveAccessToken'] = (...args) =>
  backend().liveAccessToken(...args)

export const updateAccessToken: Backend['updateAccessToken'] = (...args) =>
  backend().updateAccessToken(...args)
