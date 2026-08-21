import { Queue } from 'bullmq'
import IORedis from 'ioredis'

let connection: IORedis | null = null

export function getRedis() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
  }
  return connection
}

export const QUEUES = {
  SYNC: 'sync_queue',
  STICKER_GEN: 'sticker_gen_queue',
} as const

export type SyncJobData = {
  userId: string
  provider: string
  monthKey: string
}

export type StickerGenJobData = {
  stickerId: string
  eventId: string
  userId: string
  templateId: string
}

let syncQueue: Queue | null = null
let stickerQueue: Queue | null = null

export function getSyncQueue() {
  if (!syncQueue) syncQueue = new Queue(QUEUES.SYNC, { connection: getRedis() })
  return syncQueue
}

export function getStickerQueue() {
  if (!stickerQueue) stickerQueue = new Queue(QUEUES.STICKER_GEN, { connection: getRedis() })
  return stickerQueue
}
