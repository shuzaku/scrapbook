import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isCloudBacked } from '@/lib/journal/store'

/**
 * A picture on a shared page.
 *
 * The bucket is private and a visitor has no session, so the ordinary photo
 * route can't serve them. This checks — in the database, not here — that the
 * picture actually belongs to an entry in a scrapbook that is currently
 * shared, and only then streams it.
 *
 * Knowing a file name is not enough: the name has to appear on a shared page,
 * and the token has to be the right one for it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; name: string }> }
) {
  // Sharing is a hosted-only idea; there is nobody to share with locally.
  if (!isCloudBacked()) return new NextResponse('Not found', { status: 404 })

  const { token, name } = await params

  // The same shape check the stores use, so a name can never climb out of the
  // folder it belongs to.
  if (!/^[a-zA-Z0-9-]+\.(jpg|png|gif|webp|avif)$/.test(name)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const supabase = await createClient()
  const { data: owner } = await supabase.rpc('shared_photo_owner', {
    p_token: token,
    p_name: name,
  })

  if (!owner || typeof owner !== 'string') {
    return new NextResponse('Not found', { status: 404 })
  }

  // Only after the check: the service key can read any folder, which is
  // exactly why nothing above it may be skipped.
  const service = await createServiceClient()
  const { data, error } = await service.storage.from('photos').download(`${owner}/${name}`)
  if (error || !data) return new NextResponse('Not found', { status: 404 })

  const ext = name.slice(name.lastIndexOf('.') + 1)
  const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      'Content-Type': type,
      // Short: a share that gets switched off should stop working soon after,
      // not whenever a cache feels like it.
      'Cache-Control': 'public, max-age=300',
    },
  })
}
