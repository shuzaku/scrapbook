import { isDarkPage } from '@/lib/journal/canvas'
import type { Scrapbook } from '@/lib/journal/types'

/**
 * The front of a scrapbook: a cloth cover with a stitched spine, the chosen
 * emoji, and the title blind-stamped across it.
 */
export default function BookCover({ book }: { book: Scrapbook }) {
  const ink = isDarkPage(book.cover.color) ? 'rgba(255,255,255,0.92)' : 'rgba(28,26,46,0.85)'

  return (
    <div
      className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:-translate-y-1"
      style={{
        backgroundColor: book.cover.color,
        boxShadow: '0 14px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Spine */}
      <div
        className="absolute inset-y-0 left-0 w-[14px]"
        style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
      />
      <div
        className="absolute inset-y-3 left-[20px] w-px"
        style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
      />

      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <span className="text-4xl">{book.cover.emoji}</span>
        <span
          className="line-clamp-2 text-sm font-medium tracking-wide"
          style={{ color: ink }}
        >
          {book.title}
        </span>
      </div>
    </div>
  )
}
