/**
 * Connected accounts, one row per person per service.
 *
 * The local backing keeps a single file, which is right for one person on one
 * machine and wrong the moment there are accounts: everyone would share one
 * Spotify connection, and one person's recently-played would appear on another
 * person's page. Here a connection belongs to whoever made it, and row level
 * security is what says so.
 *
 * Encryption is **required** in this backing. Locally, an unencrypted refresh
 * token sits in a file only you can read; in a shared database it sits next to
 * everyone else's, so a save without a key is refused rather than quietly
 * storing a long-lived credential in the clear.
 */
import { createClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'
import type { ConnectionStatus, Provider, SaveTokens, StoredConnection } from './types'

const TABLE = 'journal_connections'

function canEncrypt(): boolean {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  return !!key && key.length === 64 && !key.startsWith('your_')
}

/** Refuses to store a secret it cannot protect. */
function requireEncryption(): void {
  if (canEncrypt()) return
  throw new Error(
    'TOKEN_ENCRYPTION_KEY must be set before connecting an account to a hosted journal — ' +
      'refresh tokens are not stored in the clear in a shared database.'
  )
}

async function client() {
  return createClient()
}

async function whoami(): Promise<string | null> {
  const supabase = await client()
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

interface Row {
  provider: string
  refresh_token: string | null
  encrypted: boolean
  access_token: string | null
  expires_at: number | null
  account_id: string | null
  label: string | null
  connected_at: string
}

function toConnection(row: Row): StoredConnection {
  return {
    refreshToken: row.refresh_token ?? undefined,
    encrypted: row.encrypted,
    accessToken: row.access_token,
    expiresAt: row.expires_at ?? undefined,
    accountId: row.account_id ?? undefined,
    label: row.label,
    connectedAt: row.connected_at,
  }
}

export async function getConnection(provider: Provider): Promise<StoredConnection | null> {
  const supabase = await client()
  const { data } = await supabase
    .from(TABLE)
    .select('*')
    .eq('provider', provider)
    .maybeSingle()

  return data ? toConnection(data) : null
}

export async function saveConnection(provider: Provider, tokens: SaveTokens): Promise<void> {
  requireEncryption()

  const owner = await whoami()
  if (!owner) throw new Error('not signed in')

  const supabase = await client()
  const { error } = await supabase.from(TABLE).upsert(
    {
      owner,
      provider,
      refresh_token: await encrypt(tokens.refreshToken),
      encrypted: true,
      access_token: tokens.accessToken,
      expires_at: Date.now() + tokens.expiresIn * 1000,
      label: tokens.label,
      account_id: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'owner,provider' }
  )

  if (error) throw new Error(`saving the connection failed: ${error.message}`)
}

/**
 * Stores a connection that carries no secret — an account id and a name.
 * Steam works this way, so there is nothing here to encrypt.
 */
export async function saveAccountConnection(
  provider: Provider,
  account: { accountId: string; label: string | null }
): Promise<void> {
  const owner = await whoami()
  if (!owner) throw new Error('not signed in')

  const supabase = await client()
  const { error } = await supabase.from(TABLE).upsert(
    {
      owner,
      provider,
      account_id: account.accountId,
      label: account.label,
      refresh_token: null,
      encrypted: false,
      access_token: null,
      expires_at: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'owner,provider' }
  )

  if (error) throw new Error(`saving the connection failed: ${error.message}`)
}

export async function clearConnection(provider: Provider): Promise<void> {
  const supabase = await client()
  await supabase.from(TABLE).delete().eq('provider', provider)
}

export async function connectionStatus(
  provider: Provider,
  configured: boolean
): Promise<ConnectionStatus> {
  if (!configured) return { state: 'unconfigured' }

  const record = await getConnection(provider)
  if (!record) return { state: 'disconnected' }

  return {
    state: 'connected',
    label: record.label,
    connectedAt: record.connectedAt,
    // Always false here — a save without a key is refused outright.
    plaintext: false,
  }
}

export async function refreshTokenFor(provider: Provider): Promise<string | null> {
  const record = await getConnection(provider)
  if (!record?.refreshToken) return null
  return record.encrypted ? decrypt(record.refreshToken) : record.refreshToken
}

export async function accountIdFor(provider: Provider): Promise<string | null> {
  return (await getConnection(provider))?.accountId ?? null
}

export async function liveAccessToken(provider: Provider): Promise<string | null> {
  const record = await getConnection(provider)
  if (!record?.accessToken || !record.expiresAt) return null
  // A minute of slack so a token can't expire mid-request.
  return record.expiresAt > Date.now() + 60_000 ? record.accessToken : null
}

export async function updateAccessToken(
  provider: Provider,
  accessToken: string,
  expiresIn: number,
  refreshToken?: string
): Promise<void> {
  const supabase = await client()

  const patch: Record<string, unknown> = {
    access_token: accessToken,
    expires_at: Date.now() + expiresIn * 1000,
  }

  // Some providers hand back a new refresh token on every refresh — Strava
  // always does — and keeping the old one breaks the next one.
  if (refreshToken) {
    requireEncryption()
    patch.refresh_token = await encrypt(refreshToken)
    patch.encrypted = true
  }

  await supabase.from(TABLE).update(patch).eq('provider', provider)
}
