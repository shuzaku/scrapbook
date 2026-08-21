import satori from 'satori'
import sharp from 'sharp'
import type { ReactNode } from 'react'

const STICKER_WIDTH = 400
const STICKER_HEIGHT = 400

// Load font once
let fontBuffer: ArrayBuffer | null = null
async function getFont(): Promise<ArrayBuffer> {
  if (fontBuffer) return fontBuffer
  const res = await fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff')
  fontBuffer = await res.arrayBuffer()
  return fontBuffer
}

export async function renderSticker(element: ReactNode): Promise<Buffer> {
  const font = await getFont()

  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: STICKER_WIDTH,
    height: STICKER_HEIGHT,
    fonts: [{ name: 'Inter', data: font, weight: 400, style: 'normal' }],
  })

  return sharp(Buffer.from(svg)).png().toBuffer()
}

export { STICKER_WIDTH, STICKER_HEIGHT }
