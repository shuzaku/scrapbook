/**
 * The Google Photos Picker API.
 *
 * The flow: create a session, send the person to `pickerUri` to choose photos
 * in Google's own UI, poll until `mediaItemsSet`, then list and download what
 * they picked. We never see anything they didn't choose.
 */
import { DOWNLOAD_SIZE, PICKER_API } from './config'

export interface PickerSession {
  id: string
  pickerUri: string
  mediaItemsSet: boolean
  expireTime?: string
  /** Milliseconds Google asks us to wait between polls. */
  pollInterval: number
}

export interface PickedItem {
  id: string
  baseUrl: string
  mimeType: string
  filename: string
  /** When Google says the photo was taken. Survives their re-encoding. */
  createTime: string | null
}

/**
 * A failed Picker API call, with Google's own explanation kept intact. Google
 * usually says exactly what's wrong and how to fix it, so that message is
 * worth carrying all the way to the screen rather than flattening to a 502.
 */
export class PickerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason?: string,
    readonly helpUrl?: string
  ) {
    super(message)
    this.name = 'PickerError'
  }
}

interface GoogleErrorDetail {
  reason?: string
  metadata?: { activationUrl?: string }
  links?: { url?: string }[]
}

function toPickerError(status: number, path: string, body: string): PickerError {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; details?: GoogleErrorDetail[] }
    }
    const message = parsed.error?.message ?? `Picker API ${path} failed (${status})`

    let reason: string | undefined
    let helpUrl: string | undefined
    for (const detail of parsed.error?.details ?? []) {
      reason ??= detail.reason
      helpUrl ??= detail.metadata?.activationUrl ?? detail.links?.[0]?.url
    }

    return new PickerError(message, status, reason, helpUrl)
  } catch {
    return new PickerError(`Picker API ${path} failed (${status}): ${body.slice(0, 200)}`, status)
  }
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PICKER_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    throw toPickerError(res.status, path, await res.text())
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/** Google returns durations as strings like "5s" or "2.5s". */
function seconds(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const parsed = Number.parseFloat(value.replace(/s$/, ''))
  return Number.isFinite(parsed) ? parsed * 1000 : fallback
}

interface RawSession {
  id: string
  pickerUri: string
  mediaItemsSet?: boolean
  expireTime?: string
  pollingConfig?: { pollInterval?: string; timeoutIn?: string }
}

function toSession(raw: RawSession): PickerSession {
  return {
    id: raw.id,
    pickerUri: raw.pickerUri,
    mediaItemsSet: raw.mediaItemsSet === true,
    expireTime: raw.expireTime,
    pollInterval: Math.max(1000, seconds(raw.pollingConfig?.pollInterval, 3000)),
  }
}

export async function createSession(token: string): Promise<PickerSession> {
  return toSession(await call<RawSession>(token, '/sessions', { method: 'POST', body: '{}' }))
}

export async function getSession(token: string, sessionId: string): Promise<PickerSession> {
  return toSession(await call<RawSession>(token, `/sessions/${encodeURIComponent(sessionId)}`))
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  await call<void>(token, `/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

interface RawItemsPage {
  mediaItems?: {
    id: string
    type?: string
    createTime?: string
    mediaFile?: { baseUrl?: string; mimeType?: string; filename?: string }
  }[]
  nextPageToken?: string
}

/** Everything the person picked in this session, following pagination. */
export async function listPickedItems(
  token: string,
  sessionId: string,
  limit = 50
): Promise<PickedItem[]> {
  const items: PickedItem[] = []
  let pageToken: string | undefined

  do {
    const query = new URLSearchParams({ sessionId, pageSize: '100' })
    if (pageToken) query.set('pageToken', pageToken)
    const page = await call<RawItemsPage>(token, `/mediaItems?${query}`)

    for (const item of page.mediaItems ?? []) {
      const file = item.mediaFile
      if (!file?.baseUrl || !file.mimeType) continue
      // Videos have their own download parameter and nothing to paste on a
      // page yet, so only still images come across.
      if (!file.mimeType.startsWith('image/')) continue
      items.push({
        id: item.id,
        baseUrl: file.baseUrl,
        mimeType: file.mimeType,
        filename: file.filename ?? 'photo',
        createTime: item.createTime ?? null,
      })
      if (items.length >= limit) return items
    }

    pageToken = page.nextPageToken
  } while (pageToken)

  return items
}

/** Downloads one picked photo. baseUrl needs the bearer token too. */
export async function downloadItem(token: string, item: PickedItem): Promise<File> {
  const res = await fetch(`${item.baseUrl}${DOWNLOAD_SIZE}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new PickerError(`Downloading ${item.filename} failed (${res.status})`, res.status)
  }

  const bytes = await res.arrayBuffer()

  // Trust what came back over what the item's metadata claimed. Asking for a
  // resized copy makes Google re-encode it — a HEIC original arrives as JPEG —
  // and saving it under the original's type would reject a perfectly good file.
  const served = res.headers.get('content-type')?.split(';')[0]?.trim()
  const type = served?.startsWith('image/') ? served : item.mimeType

  return new File([bytes], item.filename, { type })
}
