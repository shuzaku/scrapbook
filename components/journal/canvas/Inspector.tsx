'use client'

import { format } from 'date-fns'
import { FILL_COLORS, FONTS, INK_COLORS, TAPE_COLORS } from '@/lib/journal/canvas'
import { wallClock } from '@/lib/photos/dates'
import { MAP_STYLES, MAX_ZOOM, MIN_ZOOM, type MapStyle } from '@/lib/google/maps-shared'
import type {
  CanvasElement,
  ElementPatch,
  Frame,
  PlaceDisplay,
  ShapeKind,
} from '@/lib/journal/types'

interface Props {
  element: CanvasElement
  /** When the selected photo was taken, if known — offered as a caption. */
  takenAt?: string | null
  onChange: (patch: ElementPatch, commit?: boolean) => void
  onDelete: () => void
  onDuplicate: () => void
  onLayer: (direction: 'up' | 'down') => void
  onEditText: () => void
  /** Switches a game sticker between box art and a card, re-fetching the art. */
  onGameChange?: (display: 'cover' | 'card') => void
  /** Applies a change to a place, re-fetching its picture when needed. */
  onPlaceChange?: (changes: {
    zoom?: number
    style?: MapStyle
    display?: PlaceDisplay
  }) => void
  /** True while that re-fetch is in flight. */
  busy?: boolean
}

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs transition-colors ${
        active ? 'bg-violet-500/30 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function Dots({
  colors,
  active,
  onPick,
}: {
  colors: string[]
  active: string
  onPick: (color: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          onClick={() => onPick(color)}
          className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
            active === color ? 'border-violet-300 ring-2 ring-violet-400/60' : 'border-white/25'
          }`}
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

const Divider = () => <span className="h-6 w-px bg-white/10" />

export default function Inspector({
  element,
  takenAt,
  onChange,
  onDelete,
  onDuplicate,
  onLayer,
  onEditText,
  onPlaceChange,
  onGameChange,
  busy,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
      {element.kind === 'text' && (
        <>
          <select
            value={element.font}
            onChange={(e) => onChange({ font: e.target.value as typeof element.font })}
            className="h-8 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white [&>option]:bg-[#1a0a2e]"
          >
            {FONTS.map((font) => (
              <option key={font.key} value={font.key}>
                {font.label}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-md border border-white/15">
            <Chip onClick={() => onChange({ fontSize: Math.max(8, element.fontSize - 4) })}>
              −
            </Chip>
            <span className="w-9 text-center text-xs tabular-nums text-white/70">
              {Math.round(element.fontSize)}
            </span>
            <Chip onClick={() => onChange({ fontSize: Math.min(400, element.fontSize + 4) })}>
              ＋
            </Chip>
          </div>

          <Chip active={element.bold} onClick={() => onChange({ bold: !element.bold })} title="Bold">
            <span className="font-bold">B</span>
          </Chip>
          <Chip
            active={element.italic}
            onClick={() => onChange({ italic: !element.italic })}
            title="Italic"
          >
            <span className="italic">I</span>
          </Chip>

          {(['left', 'center', 'right'] as const).map((align) => (
            <Chip
              key={align}
              active={element.align === align}
              onClick={() => onChange({ align })}
              title={`Align ${align}`}
            >
              {align === 'left' ? '⇤' : align === 'center' ? '↔' : '⇥'}
            </Chip>
          ))}

          <Divider />
          <Dots colors={INK_COLORS} active={element.color} onPick={(color) => onChange({ color })} />
          <Divider />
          <Chip onClick={onEditText} title="Edit the words">
            ✎ Edit
          </Chip>
        </>
      )}

      {element.kind === 'photo' && (
        <>
          {(['plain', 'rounded', 'circle', 'polaroid'] as Frame[]).map((frame) => (
            <Chip key={frame} active={element.frame === frame} onClick={() => onChange({ frame })}>
              <span className="capitalize">{frame}</span>
            </Chip>
          ))}
          {element.frame === 'polaroid' && (
            <>
              <Divider />
              <input
                value={element.caption}
                onChange={(e) => onChange({ caption: e.target.value }, false)}
                onBlur={() => onChange({}, true)}
                placeholder="Caption…"
                maxLength={120}
                className="h-8 w-48 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              />
              {takenAt && (
                <Chip
                  onClick={() => onChange({ caption: format(wallClock(takenAt), 'd MMM yyyy') })}
                  title={`Taken ${format(wallClock(takenAt), 'd MMMM yyyy, HH:mm')}`}
                >
                  📅 Use date
                </Chip>
              )}
            </>
          )}
        </>
      )}

      {element.kind === 'shape' && (
        <>
          {(['rect', 'ellipse', 'line'] as ShapeKind[]).map((shape) => (
            <Chip key={shape} active={element.shape === shape} onClick={() => onChange({ shape })}>
              <span className="capitalize">{shape}</span>
            </Chip>
          ))}
          <Divider />
          <Dots
            colors={FILL_COLORS}
            active={element.color}
            onPick={(color) => onChange({ color })}
          />
        </>
      )}

      {element.kind === 'game' && (
        <>
          {element.display === 'achievement' ? (
            <span className="max-w-56 truncate px-1 text-xs text-white/50">
              {element.achievement}
              {element.name && <span className="text-white/30"> · {element.name}</span>}
            </span>
          ) : (
            <>
              {(
                [
                  { display: 'cover' as const, label: 'Box art' },
                  { display: 'card' as const, label: 'Card' },
                ]
              ).map((option) => (
                <Chip
                  key={option.display}
                  active={element.display === option.display}
                  onClick={() => onGameChange?.(option.display)}
                >
                  {option.label}
                </Chip>
              ))}
              <Divider />
              <span className="max-w-44 truncate px-1 text-xs text-white/50">{element.name}</span>
            </>
          )}

          {element.url && (
            <a
              href={element.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center rounded-md px-2 text-xs text-[#66c0f4] hover:bg-white/10"
              title="Open on Steam"
            >
              ↗ Steam
            </a>
          )}
          {busy && <span className="text-xs text-violet-200">Redrawing…</span>}
        </>
      )}

      {element.kind === 'song' && (
        <>
          {(
            [
              { display: 'card' as const, label: 'Card' },
              { display: 'art' as const, label: 'Cover only' },
            ]
          ).map((option) => (
            <Chip
              key={option.display}
              active={element.display === option.display}
              onClick={() => onChange({ display: option.display })}
            >
              {option.label}
            </Chip>
          ))}

          <Divider />
          <span className="max-w-48 truncate px-1 text-xs text-white/50">
            {element.title}
            {element.artist && <span className="text-white/30"> · {element.artist}</span>}
          </span>

          {element.linkUrl && (
            <a
              href={element.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center rounded-md px-2 text-xs text-violet-300 hover:bg-white/10"
              title="Open the track"
            >
              ↗ {element.source === 'itunes' ? 'Apple Music' : element.source === 'spotify' ? 'Spotify' : 'Link'}
            </a>
          )}
        </>
      )}

      {element.kind === 'place' && (
        <>
          {(
            [
              { display: 'pin' as const, label: 'Pin' },
              { display: 'map' as const, label: 'Map' },
              { display: 'qr' as const, label: 'Code' },
            ]
          ).map((option) => (
            <Chip
              key={option.display}
              active={element.display === option.display}
              onClick={() => onPlaceChange?.({ display: option.display })}
              title={`Show as a ${option.label.toLowerCase()}`}
            >
              {option.label}
            </Chip>
          ))}

          <Divider />
          <input
            value={element.name}
            onChange={(e) => onChange({ name: e.target.value }, false)}
            onBlur={() => onChange({}, true)}
            placeholder="Label…"
            maxLength={200}
            className="h-8 w-40 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          />

          {element.display === 'map' && (
            <>
              <Divider />
              <div className="flex items-center rounded-md border border-white/15">
                <Chip
                  onClick={() => onPlaceChange?.({ zoom: Math.max(MIN_ZOOM, element.zoom - 1) })}
                  title="Zoom out"
                >
                  −
                </Chip>
                <span className="w-8 text-center text-xs tabular-nums text-white/70">
                  {element.zoom}
                </span>
                <Chip
                  onClick={() => onPlaceChange?.({ zoom: Math.min(MAX_ZOOM, element.zoom + 1) })}
                  title="Zoom in"
                >
                  ＋
                </Chip>
              </div>
              {MAP_STYLES.map((style) => (
                <Chip
                  key={style}
                  active={element.style === style}
                  onClick={() => onPlaceChange?.({ style })}
                >
                  <span className="capitalize">{style}</span>
                </Chip>
              ))}
            </>
          )}

          {element.mapsUrl && (
            <a
              href={element.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center rounded-md px-2 text-xs text-violet-300 hover:bg-white/10"
              title="Open in Google Maps"
            >
              ↗ Maps
            </a>
          )}
          {busy && <span className="text-xs text-violet-200">Redrawing…</span>}
        </>
      )}

      {element.kind === 'tape' && (
        <Dots colors={TAPE_COLORS} active={element.color} onPick={(color) => onChange({ color })} />
      )}

      {element.kind === 'sticker' && (
        <span className="px-1 text-xs text-white/50">Drag a corner to resize the sticker</span>
      )}

      <Divider />
      <Chip onClick={() => onChange({ rotation: 0 })} title="Straighten">
        ⟲ {Math.round(element.rotation)}°
      </Chip>
      <Chip onClick={() => onLayer('down')} title="Send backward">
        ↧
      </Chip>
      <Chip onClick={() => onLayer('up')} title="Bring forward">
        ↥
      </Chip>
      <Chip onClick={onDuplicate} title="Duplicate (Ctrl+D)">
        ⧉
      </Chip>
      <button
        type="button"
        onClick={onDelete}
        title="Delete (Del)"
        className="flex h-8 items-center rounded-md px-2 text-xs text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
      >
        🗑
      </button>
    </div>
  )
}
