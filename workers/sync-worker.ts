/**
 * SyncWorker — runs on Railway as an always-on Node.js process.
 * Pulls monthly activity from connected provider accounts and writes to `events`.
 * Start with: npx tsx workers/index.ts
 */
import { Worker, type Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '../lib/crypto'
import { getStickerQueue, QUEUES, type SyncJobData, type StickerGenJobData } from '../lib/queue'
import { eventToStickerProps } from '../lib/stickers/generate'
import * as Spotify from '../lib/providers/spotify'
import * as Steam from '../lib/providers/steam'
import * as YouTube from '../lib/providers/youtube'
import type { Event, ConnectedAccount } from '../lib/supabase/types'
import IORedis from 'ioredis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function ensureFreshToken(account: ConnectedAccount): Promise<string | null> {
  if (!account.access_token) return null

  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null
  const needsRefresh = expiresAt && expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  if (!needsRefresh) {
    return decrypt(account.access_token)
  }

  try {
    let newTokens: { access_token: string; expires_in: number; refresh_token?: string }

    if (account.provider === 'spotify') {
      newTokens = await Spotify.refreshAccessToken(account.refresh_token!)
    } else if (account.provider === 'youtube') {
      newTokens = await YouTube.refreshAccessToken(account.refresh_token!)
    } else {
      return decrypt(account.access_token)
    }

    const encAccess = await encrypt(newTokens.access_token)
    const updates: Partial<ConnectedAccount> = {
      access_token: encAccess,
      token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    }
    if (newTokens.refresh_token) {
      updates.refresh_token = await encrypt(newTokens.refresh_token)
    }

    await supabase.from('connected_accounts').update(updates).eq('id', account.id)
    return newTokens.access_token
  } catch (err) {
    console.error(`Token refresh failed for ${account.provider}:`, err)
    await supabase.from('connected_accounts').update({ needs_reauth: true }).eq('id', account.id)
    return null
  }
}

async function upsertEvents(events: Omit<Event, 'id' | 'created_at' | 'user_id'>[], userId: string) {
  if (events.length === 0) return []
  const rows = events.map((e) => ({ ...e, user_id: userId }))
  const { data, error } = await supabase.from('events').upsert(rows, { onConflict: 'user_id,provider,event_type,occurred_at' }).select()
  if (error) console.error('Event upsert error:', error)
  return data ?? []
}

async function createPendingStickers(events: Event[]) {
  const stickerQueue = getStickerQueue()
  for (const event of events) {
    const { templateId } = eventToStickerProps(event)
    const { data: sticker } = await supabase
      .from('stickers')
      .insert({ event_id: event.id, user_id: event.user_id, template_id: templateId, generation_status: 'pending' })
      .select()
      .single()
    if (sticker) {
      const job: StickerGenJobData = { stickerId: sticker.id, eventId: event.id, userId: event.user_id, templateId }
      await stickerQueue.add('generate', job, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
    }
  }
}

export async function processSyncJob(job: Job<SyncJobData>) {
  const { userId, provider, monthKey } = job.data
  console.log(`[sync] ${provider} for user ${userId} month ${monthKey}`)

  const { data: account } = await supabase
    .from('connected_accounts')
    .select()
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()

  if (!account || account.needs_reauth) {
    console.warn(`[sync] Skipping ${provider} — needs reauth or not found`)
    return
  }

  let newEvents: Omit<Event, 'id' | 'created_at' | 'user_id'>[] = []

  if (provider === 'spotify') {
    const accessToken = await ensureFreshToken(account)
    if (!accessToken) return
    newEvents = await Spotify.fetchMonthEvents(accessToken, monthKey)
  } else if (provider === 'steam') {
    const steamId = (account.extra_data as Record<string, string>)?.steam_id
    if (!steamId) return
    newEvents = await Steam.fetchMonthEvents(steamId, monthKey)
  } else if (provider === 'youtube') {
    const accessToken = await ensureFreshToken(account)
    if (!accessToken) return
    newEvents = await YouTube.fetchMonthEvents(accessToken, monthKey)
  }

  const inserted = await upsertEvents(newEvents, userId)
  await supabase.from('connected_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', account.id)
  await createPendingStickers(inserted as Event[])

  console.log(`[sync] Done. ${inserted.length} events for ${provider}`)
}
