import { createClient } from '@supabase/supabase-js'
import type { Job } from 'bullmq'
import { generateStickerImage, eventToStickerProps } from '../lib/stickers/generate'
import type { StickerGenJobData } from '../lib/queue'
import type { Event } from '../lib/supabase/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function processStickerJob(job: Job<StickerGenJobData>) {
  const { stickerId, eventId, userId, templateId } = job.data
  console.log(`[sticker] Generating ${templateId} for event ${eventId}`)

  await supabase.from('stickers').update({ generation_status: 'generating' }).eq('id', stickerId)

  const { data: event } = await supabase.from('events').select().eq('id', eventId).single()
  if (!event) throw new Error(`Event ${eventId} not found`)

  const { props } = eventToStickerProps(event as Event)
  const imageBuffer = await generateStickerImage(templateId, props)

  const filePath = `stickers/${userId}/${stickerId}.png`
  const { error: uploadError } = await supabase.storage
    .from('sticker-images')
    .upload(filePath, imageBuffer, { contentType: 'image/png', upsert: true })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from('sticker-images').getPublicUrl(filePath)

  await supabase.from('stickers').update({
    image_url: publicUrl,
    generation_status: 'done',
    generated_at: new Date().toISOString(),
  }).eq('id', stickerId)

  console.log(`[sticker] Done: ${publicUrl}`)
}
