import { NextResponse } from 'next/server'
import { readPhoto } from '@/lib/journal/store'

/** Serves photos out of the local `.data/uploads` folder — no storage bucket needed. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const photo = await readPhoto(name)
  if (!photo) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(photo.body), {
    headers: {
      'Content-Type': photo.type,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
