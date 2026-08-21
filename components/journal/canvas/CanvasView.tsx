import ElementBox, { boxStyle } from './ElementBox'
import { isDarkPage, patternStyle } from '@/lib/journal/canvas'
import type { CanvasPage } from '@/lib/journal/types'

/**
 * A finished page, rendered read-only. `width` is the size to draw it at — the
 * page is laid out at its own coordinates and scaled down to fit, so the same
 * markup serves both a full-size page and a thumbnail on the shelf.
 */
export default function CanvasView({
  canvas,
  width,
  className,
  interactive = false,
  photoBase,
}: {
  canvas: CanvasPage
  width: number
  className?: string
  /** Makes place stickers open Google Maps. Off for thumbnails. */
  interactive?: boolean
  /** Where pictures come from; a shared page serves its own. */
  photoBase?: string
}) {
  const scale = width / canvas.width

  return (
    <div
      className={className}
      style={{ width, height: canvas.height * scale, overflow: 'hidden' }}
    >
      <div
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundColor: canvas.background,
          position: 'relative',
          ...patternStyle(canvas.pattern, isDarkPage(canvas.background)),
        }}
      >
        {canvas.elements.map((element) => (
          <div key={element.id} style={boxStyle(element)}>
            <ElementBox element={element} linkify={interactive} photoBase={photoBase} />
          </div>
        ))}
      </div>
    </div>
  )
}
