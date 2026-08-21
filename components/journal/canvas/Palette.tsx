'use client'

import { useRef, useState } from 'react'
import GooglePhotosImport from './GooglePhotosImport'
import EmbedPost from './EmbedPost'
import ICloudAlbumImport from './ICloudAlbumImport'
import PlaceSearch from './PlaceSearch'
import WeatherPanel from './WeatherPanel'
import MusicPanel from './MusicPanel'
import GamesPanel from './GamesPanel'
import ShelfPanel from './ShelfPanel'
import WorkoutsPanel from './WorkoutsPanel'
import SuggestPanel from './SuggestPanel'
import {
  FILL_COLORS,
  PAGE_BACKGROUNDS,
  PATTERNS,
  STICKER_GROUPS,
  TAPE_COLORS,
  fontStack,
} from '@/lib/journal/canvas'
import { isMedium } from '@/lib/media/types'
import type {
  EmbedSeed,
  GameSeed,
  MediaSeed,
  PlaceSeed,
  SongSeed,
  WeatherSeed,
  WorkoutSeed,
} from '@/lib/journal/canvas'
import type { CanvasPage, ElementKind, Pattern, Photo, ShapeKind } from '@/lib/journal/types'

/** What a palette item hands to the page when you drop it. */
export interface DragPayload {
  kind: ElementKind
  emoji?: string
  photo?: string
  shape?: ShapeKind
}

export const DRAG_TYPE = 'application/x-scrapbook-element'

const TABS = [
  { key: 'text', label: 'Text', icon: 'T' },
  { key: 'photos', label: 'Photos', icon: '🖼' },
  { key: 'stickers', label: 'Stickers', icon: '✨' },
  { key: 'shapes', label: 'Shapes', icon: '◼' },
  { key: 'places', label: 'Places', icon: '📍' },
  { key: 'music', label: 'Music', icon: '♪' },
  { key: 'games', label: 'Games', icon: '🎮' },
  { key: 'shelf', label: 'Shelf', icon: '📚' },
  { key: 'workouts', label: 'Moves', icon: '🏃' },
  { key: 'ideas', label: 'Ideas', icon: '💡' },
  { key: 'page', label: 'Page', icon: '▤' },
] as const

type TabKey = (typeof TABS)[number]['key']

interface Props {
  entryId: string
  entryDate: string
  photos: Photo[]
  canvas: CanvasPage
  onAdd: (payload: DragPayload) => void
  onPageChange: (patch: Partial<CanvasPage>) => void
  onUploaded: (photo: Photo) => void
  /** Whether Google Photos is set up, and whether it's connected. */
  googleState: 'unconfigured' | 'disconnected' | 'connected'
  /** Whether a Google Maps key is present. */
  mapsConfigured: boolean
  onAddPlace: (seed: PlaceSeed) => void
  spotifyState: 'unconfigured' | 'disconnected' | 'connected'
  onAddSong: (seed: SongSeed) => void
  steamState: 'unconfigured' | 'disconnected' | 'connected'
  onAddGame: (seed: GameSeed) => void
  onAddEmbed: (seed: EmbedSeed) => void
  onAddMedia: (seed: MediaSeed) => void
  onAddWeather: (seed: WeatherSeed) => void
  stravaState: 'unconfigured' | 'disconnected' | 'connected'
  onAddWorkout: (seed: WorkoutSeed) => void
  /** Whether an Anthropic key is set, so suggestions can be offered. */
  aiConfigured: boolean
}

/** Anything draggable onto the page is also clickable to drop it in the middle. */
function DragItem({
  payload,
  onAdd,
  className,
  style,
  title,
  children,
}: {
  payload: DragPayload
  onAdd: (payload: DragPayload) => void
  className?: string
  style?: React.CSSProperties
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAdd(payload)}
      className={className}
      style={style}
    >
      {children}
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-white/40">{label}</p>
      {children}
    </div>
  )
}

function Swatches({
  colors,
  active,
  onPick,
}: {
  colors: string[]
  active?: string
  onPick: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(color)}
          aria-label={color}
          className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
            active === color ? 'border-violet-300 ring-2 ring-violet-400/60' : 'border-white/25'
          }`}
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

export default function Palette({
  entryId,
  entryDate,
  photos,
  canvas,
  onAdd,
  onPageChange,
  onUploaded,
  googleState,
  mapsConfigured,
  onAddPlace,
  spotifyState,
  onAddSong,
  steamState,
  onAddGame,
  onAddEmbed,
  onAddMedia,
  onAddWeather,
  stravaState,
  onAddWorkout,
  aiConfigured,
}: Props) {
  const [tab, setTab] = useState<TabKey>('text')
  // Set when a suggestion sends you to another tab, so that tab can start
  // from the thing the suggestion named.
  const [prefill, setPrefill] = useState<{ tab: TabKey; query: string; medium?: string } | null>(
    null
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)

    for (const file of Array.from(files)) {
      const body = new FormData()
      body.append('file', file)
      body.append('entryId', entryId)
      const res = await fetch('/api/photos', { method: 'POST', body })
      if (res.ok) {
        onUploaded((await res.json()) as Photo)
      } else {
        const { error } = (await res.json().catch(() => ({ error: 'Upload failed' }))) as {
          error?: string
        }
        setUploadError(error ?? 'Upload failed')
      }
    }

    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 border-r border-white/10 bg-black/30">
      <nav className="flex w-[68px] shrink-0 flex-col gap-1 border-r border-white/10 p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-[10px] transition-colors ${
              tab === t.key
                ? 'bg-violet-500/25 text-white'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {tab === 'text' && (
          <Section label="Drag onto the page">
            <div className="space-y-2">
              {[
                { text: 'A heading', size: 'text-2xl', font: 'serif' as const },
                { text: 'A subheading', size: 'text-lg', font: 'sans' as const },
                { text: 'A little note in your own hand', size: 'text-base', font: 'hand' as const },
              ].map((preset) => (
                <DragItem
                  key={preset.text}
                  payload={{ kind: 'text' }}
                  onAdd={onAdd}
                  className={`block w-full cursor-grab rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-left text-white transition-colors hover:bg-white/10 ${preset.size}`}
                  style={{ fontFamily: fontStack(preset.font) }}
                >
                  {preset.text}
                </DragItem>
              ))}
            </div>
          </Section>
        )}

        {tab === 'photos' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-lg border border-dashed border-white/25 px-3 py-6 text-sm text-white/70 transition-colors hover:border-violet-400/60 hover:text-white disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '＋ Upload photos'}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <GooglePhotosImport
              entryId={entryId}
              entryDate={entryDate}
              state={googleState}
              onImported={onUploaded}
            />

            <ICloudAlbumImport entryId={entryId} onImported={onUploaded} />

            <EmbedPost onAdd={onAddEmbed} />

            {uploadError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
                {uploadError}
              </p>
            )}

            {photos.length === 0 ? (
              <p className="text-xs leading-relaxed text-white/40">
                Photos you upload land here. Drag one onto the page, or click to drop it in the
                middle.
              </p>
            ) : (
              <Section label={`${photos.length} in this entry`}>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <DragItem
                      key={photo.name}
                      payload={{ kind: 'photo', photo: photo.name }}
                      onAdd={onAdd}
                      className="aspect-square cursor-grab overflow-hidden rounded-lg border border-white/10 transition-transform hover:scale-105"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
                      <img
                        src={`/api/photos/${photo.name}`}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </DragItem>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {tab === 'stickers' && (
          <div className="space-y-5">
            {STICKER_GROUPS.map((group) => (
              <Section key={group.label} label={group.label}>
                <div className="grid grid-cols-5 gap-1.5">
                  {group.emojis.map((emoji) => (
                    <DragItem
                      key={emoji}
                      payload={{ kind: 'sticker', emoji }}
                      onAdd={onAdd}
                      className="aspect-square cursor-grab rounded-lg bg-white/5 text-2xl transition-colors hover:bg-white/15"
                    >
                      {emoji}
                    </DragItem>
                  ))}
                </div>
              </Section>
            ))}
          </div>
        )}

        {tab === 'shapes' && (
          <div className="space-y-5">
            <Section label="Shapes">
              <div className="grid grid-cols-3 gap-2">
                {(['rect', 'ellipse', 'line'] as ShapeKind[]).map((shape) => (
                  <DragItem
                    key={shape}
                    payload={{ kind: 'shape', shape }}
                    onAdd={onAdd}
                    title={shape}
                    className="flex aspect-square cursor-grab items-center justify-center rounded-lg bg-white/5 transition-colors hover:bg-white/15"
                  >
                    <span
                      className="bg-white/70"
                      style={{
                        width: shape === 'line' ? 42 : 34,
                        height: shape === 'line' ? 4 : 34,
                        borderRadius:
                          shape === 'ellipse' ? '50%' : shape === 'line' ? 9999 : 6,
                      }}
                    />
                  </DragItem>
                ))}
              </div>
            </Section>

            <Section label="Washi tape">
              <div className="space-y-2">
                {TAPE_COLORS.map((color) => (
                  <DragItem
                    key={color}
                    payload={{ kind: 'tape' }}
                    onAdd={onAdd}
                    className="block h-8 w-full cursor-grab rounded-sm transition-transform hover:scale-[1.03]"
                    style={{
                      backgroundColor: color,
                      opacity: 0.85,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 8px, transparent 8px 16px)',
                    }}
                  >
                    <span className="sr-only">Tape</span>
                  </DragItem>
                ))}
              </div>
            </Section>

            <Section label="Shape colour">
              <Swatches colors={FILL_COLORS} onPick={() => undefined} />
              <p className="text-[11px] text-white/35">
                Drop a shape, then recolour it from the bar above the page.
              </p>
            </Section>
          </div>
        )}

        {tab === 'places' && (
          <div className="space-y-5">
            <Section label="Put a place on the page">
              <PlaceSearch
                configured={mapsConfigured}
                initialQuery={prefill?.tab === 'places' ? prefill.query : undefined}
                onAdd={onAddPlace}
              />
            </Section>

            <WeatherPanel
              entryDate={entryDate}
              initialQuery={prefill?.tab === 'places' ? prefill.query : undefined}
              onAdd={onAddWeather}
            />
          </div>
        )}

        {tab === 'music' && (
          <Section label="Put a song on the page">
            <MusicPanel
              entryId={entryId}
              state={spotifyState}
              initialQuery={prefill?.tab === 'music' ? prefill.query : undefined}
              onAdd={onAddSong}
            />
          </Section>
        )}

        {tab === 'games' && (
          <Section label="Put a game on the page">
            <GamesPanel
              entryId={entryId}
              state={steamState}
              onAdd={onAddGame}
              onAddPhoto={(photo) => onAdd({ kind: 'photo', photo })}
            />
          </Section>
        )}

        {tab === 'shelf' && (
          <ShelfPanel
            initialQuery={prefill?.tab === 'shelf' ? prefill.query : undefined}
            initialMedium={
              prefill?.tab === 'shelf' && isMedium(prefill.medium) ? prefill.medium : undefined
            }
            onAdd={onAddMedia}
          />
        )}

        {tab === 'ideas' && (
          <SuggestPanel
            entryId={entryId}
            configured={aiConfigured}
            onJump={(to, query, medium) => {
              const key = TABS.find((one) => one.key === to)?.key
              if (!key) return
              setPrefill({ tab: key, query, medium })
              setTab(key)
            }}
          />
        )}

        {tab === 'workouts' && (
          <WorkoutsPanel state={stravaState} onAdd={onAddWorkout} />
        )}

        {tab === 'page' && (
          <div className="space-y-5">
            <Section label="Paper">
              <Swatches
                colors={PAGE_BACKGROUNDS}
                active={canvas.background}
                onPick={(background) => onPageChange({ background })}
              />
            </Section>

            <Section label="Texture">
              <div className="grid grid-cols-2 gap-2">
                {PATTERNS.map((pattern: Pattern) => (
                  <button
                    key={pattern}
                    type="button"
                    onClick={() => onPageChange({ pattern })}
                    className={`rounded-lg border px-3 py-2 text-xs capitalize transition-colors ${
                      canvas.pattern === pattern
                        ? 'border-violet-400 bg-violet-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {pattern}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </aside>
  )
}
