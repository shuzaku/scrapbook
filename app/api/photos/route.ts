import { NextResponse } from 'next/server'
import { attachPhoto, savePhoto } from '@/lib/journal/store'

/**
 * Upload endpoint for the page editor: stores the file locally and adds it to
 * the entry's photo tray, then hands back the name to place on the canvas.
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const entryId = String(formData.get('entryId') ?? '')
  // Cover art for a song belongs to the page, not the entry's photo tray.
  const attach = String(formData.get('attach') ?? 'true') !== 'false'
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const photo = await savePhoto(file)
  if (!photo) {
    return NextResponse.json(
      { error: 'Unsupported image — use JPEG, PNG, GIF, WebP or AVIF under 10MB' },
      { status: 415 }
    )
  }

  if (attach && !(await attachPhoto(entryId, photo))) {
    return NextResponse.json({ error: 'Unknown entry' }, { status: 404 })
  }

  return NextResponse.json(photo)
}
