/**
 * Connected accounts, kept in `.data/connections.json` next to the journal.
 *
 * One file, one record per provider. Writes merge rather than replace, so
 * connecting or dropping one service never disturbs another.
 *
 * Refresh tokens are long-lived credentials, so they're encrypted at rest when
 * TOKEN_ENCRYPTION_KEY is set. The settings screen says when they aren't.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { decrypt, encrypt } from '@/lib/crypto'
import type {
  ConnectionStatus,
  Provider,
  SaveTokens,
  StoredConnection,
} from './types'

type ConnectionsFile = Partial<Record<Provider, StoredConnection>>

const DATA_DIR = process.env.JOURNAL_DATA_DIR ?? path.join(process.cwd(), '.data')
const FILE = path.join(DATA_DIR, 'connections.json')

function canEncrypt(): boolean {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  return !!key && key.length === 64 && !key.startsWith('your_')
}

async function readAll(): Promise<ConnectionsFile> {
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as ConnectionsFile
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw err
  }
}

async function writeAll(data: ConnectionsFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.${randomUUID()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  try {
    await fs.rename(tmp, FILE)
  } catch (err) {
    await fs.unlink(tmp).catch(() => {})
    throw err
  }
}

export async function getConnection(provider: Provider): Promise<StoredConnection | null> {
  const record = (await readAll())[provider]
  if (!record) return null
  // Read the old field name too, so a connection made before this existed
  // keeps showing its account.
  return { ...record, label: record.label ?? record.email ?? null }
}

export async function saveConnection(provider: Provider, tokens: SaveTokens): Promise<void> {
  const encrypted = canEncrypt()
  const all = await readAll()

  await writeAll({
    ...all,
    [provider]: {
      refreshToken: encrypted ? await encrypt(tokens.refreshToken) : tokens.refreshToken,
      encrypted,
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
      label: tokens.label,
      connectedAt: new Date().toISOString(),
    },
  })
}

/**
 * Stores a connection that carries no secret — an account id and a name.
 * Steam works this way: nothing here needs encrypting.
 */
export async function saveAccountConnection(
  provider: Provider,
  account: { accountId: string; label: string | null }
): Promise<void> {
  const all = await readAll()
  await writeAll({
    ...all,
    [provider]: {
      accountId: account.accountId,
      label: account.label,
      connectedAt: new Date().toISOString(),
    },
  })
}

export async function clearConnection(provider: Provider): Promise<void> {
  const all = await readAll()
  delete all[provider]
  await writeAll(all)
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
    // Only meaningful where there's a secret to protect in the first place.
    plaintext: record.refreshToken ? !record.encrypted : false,
  }
}

/** The refresh token in the clear, for a provider's refresh call. */
export async function refreshTokenFor(provider: Provider): Promise<string | null> {
  const record = await getConnection(provider)
  if (!record?.refreshToken) return null
  return record.encrypted ? decrypt(record.refreshToken) : record.refreshToken
}

/** The stored account id, for providers that identify you by one. */
export async function accountIdFor(provider: Provider): Promise<string | null> {
  return (await getConnection(provider))?.accountId ?? null
}

/** An access token that hasn't expired, or null if one needs fetching. */
export async function liveAccessToken(provider: Provider): Promise<string | null> {
  const record = await getConnection(provider)
  if (!record?.accessToken || !record.expiresAt) return null
  // A minute of slack so a token can't expire mid-request.
  return record.expiresAt > Date.now() + 60_000 ? record.accessToken : null
}

/** Stores a freshly refreshed access token, keeping everything else. */
export async function updateAccessToken(
  provider: Provider,
  accessToken: string,
  expiresIn: number,
  refreshToken?: string
): Promise<void> {
  const all = await readAll()
  const existing = all[provider]
  if (!existing) return

  await writeAll({
    ...all,
    [provider]: {
      ...existing,
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      // Some providers hand back a new refresh token; keep the old one if not.
      ...(refreshToken
        ? {
            refreshToken: canEncrypt() ? await encrypt(refreshToken) : refreshToken,
            encrypted: canEncrypt(),
          }
        : {}),
    },
  })
}
