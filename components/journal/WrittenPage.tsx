import { format } from 'date-fns'
import { fontStack } from '@/lib/journal/canvas'
import { elementScale, type PageSize } from '@/lib/journal/sizes'
import type { Entry } from '@/lib/journal/types'

/**
 * How an entry looks in the reader when it has no laid-out page: the written
 * words set on plain paper, at the same proportions as a designed page so the
 * two flip alike.
 */
export default function WrittenPage({
  entry,
  width,
  size,
}: {
  entry: Entry
  width: number
  size: PageSize
}) {
  const scale = width / size.width
  // Typography is written for a page about 1080 wide; smaller formats need it
  // proportionally smaller or the words swamp the paper.
  const k = elementScale(size.width)

  return (
    <div style={{ width, height: size.height * scale, overflow: 'hidden' }}>
      <div
        style={{
          width: size.width,
          height: size.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          backgroundColor: '#faf7f0',
          color: '#1c1a2e',
          padding: Math.round(96 * k),
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <p
          style={{
            fontSize: 30 * k,
            opacity: 0.55,
            display: 'flex',
            alignItems: 'center',
            gap: 12 * k,
          }}
        >
          {entry.mood && <span style={{ fontSize: 38 * k }}>{entry.mood}</span>}
          {format(new Date(`${entry.date}T12:00:00`), 'EEEE, d MMMM yyyy')}
        </p>

        <h2
          style={{
            fontFamily: fontStack('serif'),
            fontSize: 68 * k,
            lineHeight: 1.1,
            marginTop: 18 * k,
          }}
        >
          {entry.title}
        </h2>

        <div
          style={{
            marginTop: 40 * k,
            fontFamily: fontStack('hand'),
            fontSize: 40 * k,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {entry.body}
        </div>

        {entry.photos.length > 0 && (
          <div style={{ display: 'flex', gap: 20 * k, marginTop: 32 * k }}>
            {entry.photos.slice(0, 3).map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
              <img
                key={photo.name}
                src={`/api/photos/${photo.name}`}
                alt=""
                style={{
                  width: 260 * k,
                  height: 260 * k,
                  objectFit: 'cover',
                  borderRadius: 12 * k,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
