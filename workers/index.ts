/**
 * Worker entrypoint — run on Railway:
 *   npx tsx workers/index.ts
 */
import 'dotenv/config'
import { Worker } from 'bullmq'
import { getRedis, QUEUES } from '../lib/queue'
import { processSyncJob } from './sync-worker'
import { processStickerJob } from './sticker-worker'

const connection = getRedis()

const syncWorker = new Worker(QUEUES.SYNC, processSyncJob, {
  connection,
  concurrency: 5,
})

const stickerWorker = new Worker(QUEUES.STICKER_GEN, processStickerJob, {
  connection,
  concurrency: 3,
})

syncWorker.on('completed', (job) => console.log(`[sync] Job ${job.id} completed`))
syncWorker.on('failed', (job, err) => console.error(`[sync] Job ${job?.id} failed:`, err))
stickerWorker.on('completed', (job) => console.log(`[sticker] Job ${job.id} completed`))
stickerWorker.on('failed', (job, err) => console.error(`[sticker] Job ${job?.id} failed:`, err))

console.log('Workers started — sync + sticker_gen')
