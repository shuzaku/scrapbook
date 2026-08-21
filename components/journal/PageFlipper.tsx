'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import CanvasView from './canvas/CanvasView'
import WrittenPage from './WrittenPage'
import { isDarkPage } from '@/lib/journal/canvas'
import { pageSize, type PageSize } from '@/lib/journal/sizes'
import type { Entry, Scrapbook } from '@/lib/journal/types'

const TURN_MS = 520
const ZOOM_STEP = 0.25
const MAX_ZOOM = 4

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(1, Math.round(z * 100) / 100))

interface Props {
  book: Scrapbook
  /** Oldest first — the order you'd read them in. */
  entries: Entry[]
  /** Sheet to open on: 0 is the cover, n is entries[n - 1]. */
  startIndex?: number
}

/** Sheet 0 is the cover; sheet n is entries[n - 1]. */
type Sheet = { kind: 'cover' } | { kind: 'entry'; entry: Entry }

function Cover({ book, width, size }: { book: Scrapbook; width: number; size: PageSize }) {
  const ink = isDarkPage(book.cover.color) ? 'rgba(255,255,255,0.95)' : 'rgba(28,26,46,0.9)'

  return (
    <div
      className="flex flex-col items-center justify-center gap-6"
      style={{
        width,
        height: (width * size.height) / size.width,
        backgroundColor: book.cover.color,
        color: ink,
      }}
    >
      <span style={{ fontSize: width * 0.16 }}>{book.cover.emoji}</span>
      <div className="px-10 text-center">
        <h2 className="text-2xl font-semibold tracking-wide">{book.title}</h2>
        {book.subtitle && <p className="mt-2 text-sm opacity-70">{book.subtitle}</p>}
      </div>
    </div>
  )
}

/** The shape a sheet is drawn at — a page keeps whatever it was made at. */
function sheetSize(sheet: Sheet, book: PageSize): { width: number; height: number } {
  if (sheet.kind === 'entry' && sheet.entry.canvas && sheet.entry.canvas.elements.length > 0) {
    return { width: sheet.entry.canvas.width, height: sheet.entry.canvas.height }
  }
  return { width: book.width, height: book.height }
}

function SheetView({
  sheet,
  book,
  size,
  width,
}: {
  sheet: Sheet
  book: Scrapbook
  size: PageSize
  width: number
}) {
  if (sheet.kind === 'cover') return <Cover book={book} width={width} size={size} />
  if (sheet.entry.canvas && sheet.entry.canvas.elements.length > 0) {
    return <CanvasView canvas={sheet.entry.canvas} width={width} interactive />
  }
  return <WrittenPage entry={sheet.entry} width={width} size={size} />
}

export default function PageFlipper({ book, entries, startIndex = 0 }: Props) {
  const sheets: Sheet[] = [
    { kind: 'cover' },
    ...entries.map((entry) => ({ kind: 'entry' as const, entry })),
  ]

  const [index, setIndex] = useState(startIndex)
  /** While a turn plays: which sheet sits still, and which one swings. */
  const [turn, setTurn] = useState<{ base: number; leaf: number; dir: 'next' | 'prev' } | null>(null)
  const [box, setBox] = useState({ width: 600, height: 800 })
  /** 1 means "fitted to the window"; above that the page scrolls. */
  const [zoom, setZoom] = useState(1)

  const stageRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const size = pageSize(book.pageSize)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox({ width, height })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      setIndex((current) => {
        const next = dir === 'next' ? current + 1 : current - 1
        if (next < 0 || next >= sheets.length) return current

        // Turning forward, the page you're leaving swings away and reveals the
        // new one. Turning back, the older page swings in on top.
        setTurn(
          dir === 'next'
            ? { base: next, leaf: current, dir }
            : { base: current, leaf: next, dir }
        )
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setTurn(null), TURN_MS)
        return next
      })
    },
    [sheets.length]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoom((z) => clampZoom(z + ZOOM_STEP))
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setZoom((z) => clampZoom(z - ZOOM_STEP))
      } else if (e.key === '0') {
        e.preventDefault()
        setZoom(1)
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go('next')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go('prev')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const sheet = sheets[turn ? turn.base : index]
  const current = sheets[index]
  const atStart = index === 0
  const atEnd = index === sheets.length - 1

  // Fit this sheet's own shape into the stage, then apply the zoom on top.
  const shape = sheetSize(sheet, size)
  const fitted = Math.max(
    160,
    Math.floor(Math.min(box.width - 24, ((box.height - 24) * shape.width) / shape.height))
  )
  const width = Math.round(fitted * zoom)
  const height = Math.round((width * shape.height) / shape.width)

  return (
    <div className="flex h-screen flex-col bg-[#0d0b16] text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Link href={`/book/${book.id}`} className="text-sm text-white/60 hover:text-white">
          ← Close
        </Link>
        <span className="h-5 w-px bg-white/10" />
        <span className="truncate text-sm font-medium">{book.title}</span>
        <span className="hidden text-xs text-white/30 sm:inline">{size.label}</span>

        <div className="ml-auto flex items-center gap-2 text-xs text-white/45">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            disabled={zoom <= 1}
            className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-white disabled:opacity-30"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-14 rounded-md px-1 py-1 tabular-nums hover:bg-white/10 hover:text-white"
            title="Fit to window"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
            className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-white disabled:opacity-30"
            aria-label="Zoom in"
          >
            ＋
          </button>
          <span className="h-5 w-px bg-white/10" />
          <span className="tabular-nums">
            {index === 0 ? 'Cover' : `${index} / ${sheets.length - 1}`}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center gap-4 px-4 py-6">
        <button
          type="button"
          onClick={() => go('prev')}
          disabled={atStart}
          aria-label="Previous page"
          className="shrink-0 rounded-full border border-white/10 px-4 py-6 text-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
        >
          ‹
        </button>

        <div
          ref={stageRef}
          onWheel={(e) => {
            // Ctrl+wheel zooms, the way every other canvas does.
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()
            setZoom((z) => clampZoom(z - Math.sign(e.deltaY) * -ZOOM_STEP))
          }}
          className={`relative flex min-h-0 flex-1 ${
            zoom > 1 ? 'items-start justify-start overflow-auto' : 'items-center justify-center'
          }`}
          style={{ perspective: 2400 }}
        >
          <div className="relative m-auto shrink-0" style={{ width, height }}>
            <div className="absolute inset-0 overflow-hidden rounded-r-md shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
              <SheetView sheet={sheet} book={book} size={size} width={width} />
            </div>

            {turn && (
              <div
                className={`absolute inset-0 overflow-hidden rounded-r-md shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${
                  turn.dir === 'next' ? 'page-turn-out' : 'page-turn-in'
                }`}
              >
                <SheetView sheet={sheets[turn.leaf]} book={book} size={size} width={width} />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go('next')}
          disabled={atEnd}
          aria-label="Next page"
          className="shrink-0 rounded-full border border-white/10 px-4 py-6 text-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>

      <footer className="flex shrink-0 items-center justify-center gap-4 border-t border-white/10 px-4 py-3 text-sm">
        {current.kind === 'entry' ? (
          <>
            <span className="truncate text-white/70">{current.entry.title}</span>
            <span className="text-white/25">·</span>
            <span className="shrink-0 text-white/40">
              {format(new Date(`${current.entry.date}T12:00:00`), 'd MMM yyyy')}
            </span>
            <Link
              href={`/entry/${current.entry.id}`}
              className="shrink-0 text-violet-300 hover:text-violet-200"
            >
              Open
            </Link>
          </>
        ) : (
          <span className="text-white/40">
            {entries.length === 0
              ? 'This book has no entries yet'
              : 'Use ← and → to turn the pages'}
          </span>
        )}
      </footer>
    </div>
  )
}
