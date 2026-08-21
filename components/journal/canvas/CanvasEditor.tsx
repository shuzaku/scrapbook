'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ElementBox, { boxStyle } from './ElementBox'
import Inspector from './Inspector'
import Palette, { DRAG_TYPE, type DragPayload } from './Palette'
import { saveCanvasAction } from '@/lib/journal/actions'
import {
  MIN_SIZE,
  createElement,
  emptyCanvas,
  fontStack,
  isDarkPage,
  patternStyle,
} from '@/lib/journal/canvas'
import type { MapStyle } from '@/lib/google/maps-shared'
import type { PageSize } from '@/lib/journal/sizes'
import type {
  CanvasElement,
  PlaceDisplay,
  CanvasPage,
  ElementPatch,
  Entry,
  Photo,
} from '@/lib/journal/types'

/** Corner and edge grips, named for the directions they move. */
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLES: { handle: Handle; cursor: string; at: [number, number] }[] = [
  { handle: 'nw', cursor: 'nwse-resize', at: [0, 0] },
  { handle: 'n', cursor: 'ns-resize', at: [0.5, 0] },
  { handle: 'ne', cursor: 'nesw-resize', at: [1, 0] },
  { handle: 'e', cursor: 'ew-resize', at: [1, 0.5] },
  { handle: 'se', cursor: 'nwse-resize', at: [1, 1] },
  { handle: 's', cursor: 'ns-resize', at: [0.5, 1] },
  { handle: 'sw', cursor: 'nesw-resize', at: [0, 1] },
  { handle: 'w', cursor: 'ew-resize', at: [0, 0.5] },
]

/** How close (in screen pixels) a centre must be before it snaps. */
const SNAP = 7
const HISTORY_LIMIT = 60

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Keeps the page between legible and enormous. */
const clampEditorZoom = (z: number) => Math.min(4, Math.max(0.1, Math.round(z * 100) / 100))

/** Rotates a delta into (or out of) an element's own frame. */
function rotateDelta(dx: number, dy: number, deg: number) {
  const c = Math.cos(toRad(deg))
  const s = Math.sin(toRad(deg))
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

interface Props {
  entry: Entry
  /** The book's format — used for a page that hasn't been laid out yet. */
  size: PageSize
  googleState: 'unconfigured' | 'disconnected' | 'connected'
  mapsConfigured: boolean
  spotifyState: 'unconfigured' | 'disconnected' | 'connected'
  stravaState: 'unconfigured' | 'disconnected' | 'connected'
  /** Whether an Anthropic key is set, so suggestions can be offered. */
  aiConfigured: boolean
  steamState: 'unconfigured' | 'disconnected' | 'connected'
}

export default function CanvasEditor({
  entry,
  size,
  googleState,
  mapsConfigured,
  spotifyState,
  stravaState,
  aiConfigured,
  steamState,
}: Props) {
  const [canvas, setCanvas] = useState<CanvasPage>(entry.canvas ?? emptyCanvas(size))
  const [photos, setPhotos] = useState<Photo[]>(entry.photos)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [history, setHistory] = useState<{ stack: CanvasPage[]; index: number }>(() => ({
    stack: [entry.canvas ?? emptyCanvas(size)],
    index: 0,
  }))
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false })
  const [fitScale, setFitScale] = useState(0.4)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [busyPlace, setBusyPlace] = useState(false)

  const pageRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  // Mirrors `canvas` so pointer handlers always read the newest page.
  const canvasRef = useRef(canvas)
  const dirty = useRef(false)

  const scale = zoom === 'fit' ? fitScale : zoom
  const selected = canvas.elements.find((e) => e.id === selectedId) ?? null
  const dark = isDarkPage(canvas.background)

  /* ------------------------------------------------------------- plumbing */

  const pushHistory = useCallback((next: CanvasPage) => {
    setHistory((prev) => {
      const stack = [...prev.stack.slice(0, prev.index + 1), next].slice(-HISTORY_LIMIT)
      return { stack, index: stack.length - 1 }
    })
  }, [])

  const apply = useCallback(
    (next: CanvasPage, commit = true) => {
      canvasRef.current = next
      dirty.current = true
      setCanvas(next)
      if (commit) pushHistory(next)
    },
    [pushHistory]
  )

  const updateElement = useCallback(
    (id: string, patch: ElementPatch, commit = true) => {
      const prev = canvasRef.current
      apply(
        {
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === id ? ({ ...el, ...patch } as CanvasElement) : el
          ),
        },
        commit
      )
    },
    [apply]
  )

  /** Re-commits the current page — used at the end of a drag. */
  const commit = useCallback(() => pushHistory(canvasRef.current), [pushHistory])

  useEffect(() => {
    canvasRef.current = canvas
  }, [canvas])

  // Autosave, debounced, once the page has actually been touched.
  useEffect(() => {
    if (!dirty.current) return
    setSaveState('saving')
    const timer = setTimeout(() => {
      saveCanvasAction(entry.id, JSON.stringify(canvasRef.current))
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 700)
    return () => clearTimeout(timer)
  }, [canvas, entry.id])

  // Keep the page fitted to whatever room the viewport has.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entryBox]) => {
      const { width, height } = entryBox.contentRect
      setFitScale(
        Math.min((width - 64) / canvasRef.current.width, (height - 64) / canvasRef.current.height)
      )
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  /* ---------------------------------------------------------- interaction */

  const toPage = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = pageRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
    },
    [scale]
  )

  const addElement = useCallback(
    (payload: DragPayload, at?: { x: number; y: number }) => {
      const page = canvasRef.current
      const element = createElement(
        payload.kind,
        at ?? { x: page.width / 2, y: page.height / 2 },
        { emoji: payload.emoji, photo: payload.photo, shape: payload.shape },
        page.width
      )
      apply({ ...page, elements: [...page.elements, element] })
      setSelectedId(element.id)
      if (element.kind === 'text') setEditingId(element.id)
    },
    [apply]
  )

  const removeElement = useCallback(
    (id: string) => {
      const page = canvasRef.current
      apply({ ...page, elements: page.elements.filter((el) => el.id !== id) })
      setSelectedId(null)
      setEditingId(null)
    },
    [apply]
  )

  const duplicateElement = useCallback(
    (id: string) => {
      const page = canvasRef.current
      const source = page.elements.find((el) => el.id === id)
      if (!source) return
      const copy = { ...source, id: `${source.id}-c${Date.now().toString(36)}`, x: source.x + 32, y: source.y + 32 }
      apply({ ...page, elements: [...page.elements, copy] })
      setSelectedId(copy.id)
    },
    [apply]
  )

  const moveLayer = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const page = canvasRef.current
      const index = page.elements.findIndex((el) => el.id === id)
      const target = direction === 'up' ? index + 1 : index - 1
      if (index === -1 || target < 0 || target >= page.elements.length) return
      const elements = [...page.elements]
      ;[elements[index], elements[target]] = [elements[target], elements[index]]
      apply({ ...page, elements })
    },
    [apply]
  )

  /**
   * Redraws a place after a change that needs a new picture — a different
   * zoom or style, or switching to a display whose image doesn't exist yet.
   * The element updates straight away so the controls feel live.
   */
  const updatePlace = useCallback(
    async (id: string, changes: { zoom?: number; style?: MapStyle; display?: PlaceDisplay }) => {
      const element = canvasRef.current.elements.find((el) => el.id === id)
      if (!element || element.kind !== 'place') return

      const zoom = changes.zoom ?? element.zoom
      const style = changes.style ?? element.style
      const display = changes.display ?? element.display
      const patch: ElementPatch = { zoom, style, display }

      const needsMap = display === 'map' && (!element.mapImage || zoom !== element.zoom || style !== element.style)
      const needsQr = display === 'qr' && !element.qrImage

      if (!needsMap && !needsQr) {
        updateElement(id, patch)
        return
      }

      updateElement(id, patch, false)
      setBusyPlace(true)
      try {
        const body = needsMap
          ? { kind: 'map', centre: element.centre, zoom, style }
          : { kind: 'qr', url: element.mapsUrl }

        const res = await fetch('/api/integrations/google/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('could not redraw')
        const data = (await res.json()) as { image: string }
        updateElement(id, { ...patch, ...(needsMap ? { mapImage: data.image } : { qrImage: data.image }) })
      } catch {
        // Put it back rather than leaving a display with no picture.
        updateElement(id, { zoom: element.zoom, style: element.style, display: element.display })
      } finally {
        setBusyPlace(false)
      }
    },
    [updateElement]
  )

  /**
   * Swaps a game sticker between its box art and its banner. Steam serves both
   * publicly, so this is just a different picture for the same app.
   */
  const updateGame = useCallback(
    async (id: string, display: 'cover' | 'card') => {
      const element = canvasRef.current.elements.find((el) => el.id === id)
      if (!element || element.kind !== 'game' || element.display === display) return

      updateElement(id, { display }, false)
      setBusyPlace(true)
      try {
        const artUrl =
          display === 'cover'
            ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${element.appId}/library_600x900_2x.jpg`
            : `https://cdn.cloudflare.steamstatic.com/steam/apps/${element.appId}/header.jpg`

        const res = await fetch('/api/music/art', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artUrl }),
        })
        if (!res.ok) throw new Error('could not redraw')
        const data = (await res.json()) as { image: string }
        updateElement(id, { display, image: data.image })
      } catch {
        updateElement(id, { display: element.display })
      } finally {
        setBusyPlace(false)
      }
    },
    [updateElement]
  )

  /** Move, resize and rotate all run through here. */
  const beginDrag = useCallback(
    (
      event: React.PointerEvent,
      mode: { type: 'move' } | { type: 'resize'; handle: Handle } | { type: 'rotate' },
      element: CanvasElement
    ) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectedId(element.id)

      const start = { ...element }
      const origin = toPage(event)
      const centre = { x: start.x + start.w / 2, y: start.y + start.h / 2 }
      let moved = false

      const onMove = (ev: PointerEvent) => {
        const point = toPage(ev)
        const dx = point.x - origin.x
        const dy = point.y - origin.y
        if (!moved && Math.hypot(dx, dy) < 1) return
        moved = true
        const page = canvasRef.current

        if (mode.type === 'move') {
          let x = start.x + dx
          let y = start.y + dy
          const threshold = SNAP / scale
          const snapV = Math.abs(x + start.w / 2 - page.width / 2) < threshold
          const snapH = Math.abs(y + start.h / 2 - page.height / 2) < threshold
          if (snapV) x = page.width / 2 - start.w / 2
          if (snapH) y = page.height / 2 - start.h / 2
          setGuides({ v: snapV, h: snapH })
          updateElement(start.id, { x: Math.round(x), y: Math.round(y) }, false)
          return
        }

        if (mode.type === 'rotate') {
          let deg =
            (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI + 90
          if (deg > 180) deg -= 360
          const nearRightAngle = Math.round(deg / 90) * 90
          if (ev.shiftKey) deg = Math.round(deg / 15) * 15
          else if (Math.abs(deg - nearRightAngle) < 3) deg = nearRightAngle
          updateElement(start.id, { rotation: Math.round(deg) }, false)
          return
        }

        // Resize: work in the element's own frame so rotation doesn't skew it.
        const local = rotateDelta(dx, dy, -start.rotation)
        const sx = mode.handle.includes('e') ? 1 : mode.handle.includes('w') ? -1 : 0
        const sy = mode.handle.includes('s') ? 1 : mode.handle.includes('n') ? -1 : 0

        let w = Math.max(MIN_SIZE, start.w + sx * local.x)
        let h = Math.max(MIN_SIZE, start.h + sy * local.y)

        const isCorner = sx !== 0 && sy !== 0
        if (isCorner && (ev.shiftKey || start.kind === 'sticker')) {
          const ratio = start.w / start.h
          if (w / h > ratio) w = h * ratio
          else h = w / ratio
        }

        // Keep the grabbed corner's opposite anchored while the box grows.
        const shift = rotateDelta((sx * (w - start.w)) / 2, (sy * (h - start.h)) / 2, start.rotation)
        const patch: ElementPatch = {
          w: Math.round(w),
          h: Math.round(h),
          x: Math.round(centre.x + shift.x - w / 2),
          y: Math.round(centre.y + shift.y - h / 2),
        }
        // Text scales with its box, the way it does when you drag a text corner.
        if (start.kind === 'text' && isCorner) {
          patch.fontSize = Math.max(8, Math.round(start.fontSize * (h / start.h)))
        }
        updateElement(start.id, patch, false)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setGuides({ v: false, h: false })
        if (moved) commit()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [commit, scale, toPage, updateElement]
  )

  /* ------------------------------------------------------------- history */

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index <= 0) return prev
      const next = prev.stack[prev.index - 1]
      canvasRef.current = next
      dirty.current = true
      setCanvas(next)
      return { ...prev, index: prev.index - 1 }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index >= prev.stack.length - 1) return prev
      const next = prev.stack[prev.index + 1]
      canvasRef.current = next
      dirty.current = true
      setCanvas(next)
      return { ...prev, index: prev.index + 1 }
    })
  }, [])

  /* ------------------------------------------------------------ keyboard */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      const mod = e.metaKey || e.ctrlKey

      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom(clampEditorZoom(scale + 0.1))
        return
      }
      if (mod && e.key === '-') {
        e.preventDefault()
        setZoom(clampEditorZoom(scale - 0.1))
        return
      }
      if (mod && e.key === '0') {
        e.preventDefault()
        setZoom('fit')
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Escape') {
        setEditingId(null)
        setSelectedId(null)
        return
      }
      if (typing || !selectedId) return

      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateElement(selectedId)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeElement(selectedId)
        return
      }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        moveLayer(selectedId, e.key === ']' ? 'up' : 'down')
        return
      }
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const delta = nudge[e.key]
      if (delta) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const element = canvasRef.current.elements.find((el) => el.id === selectedId)
        if (element) {
          updateElement(selectedId, {
            x: element.x + delta[0] * step,
            y: element.y + delta[1] * step,
          })
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [duplicateElement, moveLayer, redo, removeElement, scale, selectedId, undo, updateElement])

  /* ---------------------------------------------------------------- view */

  const handleSize = 11 / scale
  const hairline = 1.5 / scale

  return (
    <div className="flex h-screen flex-col bg-[#0d0b16] text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Link href={`/entry/${entry.id}`} className="text-sm text-white/60 hover:text-white">
          ← Back
        </Link>
        <span className="h-5 w-px bg-white/10" />
        <span className="truncate text-sm font-medium">{entry.title}</span>

        <div className="ml-4 flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={history.index <= 0}
            className="rounded-md px-2 py-1 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={history.index >= history.stack.length - 1}
            className="rounded-md px-2 py-1 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-white/45">
          <button
            type="button"
            onClick={() => setZoom(clampEditorZoom(scale - 0.1))}
            className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-white"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom('fit')}
            className="w-14 rounded-md px-1 py-1 tabular-nums hover:bg-white/10 hover:text-white"
            title="Fit to window"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom(clampEditorZoom(scale + 0.1))}
            className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-white"
          >
            ＋
          </button>
          <span className="h-5 w-px bg-white/10" />
          <span className="hidden text-white/30 sm:inline">
            {canvas.width} × {canvas.height}
          </span>
          <span className="h-5 w-px bg-white/10" />
          <span className="w-24 text-right">
            {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'All saved'}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette
          entryId={entry.id}
          entryDate={entry.date}
          photos={photos}
          canvas={canvas}
          onAdd={(payload) => addElement(payload)}
          onPageChange={(patch) => apply({ ...canvasRef.current, ...patch })}
          onUploaded={(photo) => setPhotos((prev) => [...prev, photo])}
          googleState={googleState}
          mapsConfigured={mapsConfigured}
          onAddPlace={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'place',
              { x: page.width / 2, y: page.height / 2 },
              { place: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
          spotifyState={spotifyState}
          onAddSong={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'song',
              { x: page.width / 2, y: page.height / 2 },
              { song: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
          steamState={steamState}
          stravaState={stravaState}
          aiConfigured={aiConfigured}
          onAddWorkout={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'workout',
              { x: page.width / 2, y: page.height / 2 },
              { workout: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
          onAddWeather={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'weather',
              { x: page.width / 2, y: page.height / 2 },
              { weather: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
          onAddMedia={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'media',
              { x: page.width / 2, y: page.height / 2 },
              { media: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
          onAddEmbed={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'embed',
              { x: page.width / 2, y: page.height / 2 },
              { embed: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
          onAddGame={(seed) => {
            const page = canvasRef.current
            const element = createElement(
              'game',
              { x: page.width / 2, y: page.height / 2 },
              { game: seed },
              page.width
            )
            apply({ ...page, elements: [...page.elements, element] })
            setSelectedId(element.id)
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-4 py-2">
            {selected ? (
              <Inspector
                element={selected}
                takenAt={
                  selected.kind === 'photo'
                    ? (photos.find((p) => p.name === selected.photo)?.takenAt ?? null)
                    : null
                }
                onChange={(patch, commitChange = true) =>
                  updateElement(selected.id, patch, commitChange)
                }
                onDelete={() => removeElement(selected.id)}
                onDuplicate={() => duplicateElement(selected.id)}
                onLayer={(direction) => moveLayer(selected.id, direction)}
                onEditText={() => setEditingId(selected.id)}
                onPlaceChange={(changes) => updatePlace(selected.id, changes)}
                onGameChange={(display) => updateGame(selected.id, display)}
                busy={busyPlace}
              />
            ) : (
              <p className="px-1 py-2.5 text-xs text-white/35">
                Drag anything from the left onto the page · click to select · double-click text to
                write · Del removes · Ctrl+Z undoes
              </p>
            )}
          </div>

          <div
            ref={viewportRef}
            className="grid min-h-0 flex-1 place-items-center overflow-auto p-8"
            onWheel={(e) => {
              if (!e.ctrlKey && !e.metaKey) return
              e.preventDefault()
              setZoom(clampEditorZoom(scale - Math.sign(e.deltaY) * 0.1))
            }}
            onPointerDown={() => {
              setSelectedId(null)
              setEditingId(null)
            }}
          >
            <div
              style={{ width: canvas.width * scale, height: canvas.height * scale }}
              className="shrink-0"
            >
              <div
                ref={pageRef}
                onPointerDown={(e) => e.stopPropagation()}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const raw = e.dataTransfer.getData(DRAG_TYPE)
                  if (!raw) return
                  addElement(JSON.parse(raw) as DragPayload, toPage(e))
                }}
                style={{
                  width: canvas.width,
                  height: canvas.height,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  backgroundColor: canvas.background,
                  position: 'relative',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
                  ...patternStyle(canvas.pattern, dark),
                }}
              >
                {canvas.elements.map((element) => {
                  const isSelected = element.id === selectedId
                  const isEditing = element.id === editingId

                  return (
                    <div
                      key={element.id}
                      style={{ ...boxStyle(element), cursor: isEditing ? 'text' : 'move' }}
                      onPointerDown={(e) => {
                        if (isEditing) {
                          e.stopPropagation()
                          return
                        }
                        beginDrag(e, { type: 'move' }, element)
                      }}
                      onDoubleClick={() => {
                        if (element.kind === 'text') setEditingId(element.id)
                      }}
                    >
                      {isEditing && element.kind === 'text' ? (
                        <textarea
                          autoFocus
                          value={element.text}
                          onChange={(e) =>
                            updateElement(element.id, { text: e.target.value }, false)
                          }
                          onBlur={() => {
                            setEditingId(null)
                            commit()
                          }}
                          className="h-full w-full resize-none border-none bg-transparent p-0 outline-none"
                          style={{
                            fontFamily: fontStack(element.font),
                            fontSize: element.fontSize,
                            lineHeight: 1.25,
                            color: element.color,
                            textAlign: element.align,
                            fontWeight: element.bold ? 700 : 400,
                            fontStyle: element.italic ? 'italic' : 'normal',
                          }}
                        />
                      ) : (
                        <ElementBox element={element} />
                      )}

                      {isSelected && !isEditing && (
                        <>
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{ outline: `${hairline}px solid #8b5cf6` }}
                          />
                          {HANDLES.map(({ handle, cursor, at }) => (
                            <div
                              key={handle}
                              onPointerDown={(e) => beginDrag(e, { type: 'resize', handle }, element)}
                              style={{
                                position: 'absolute',
                                left: `calc(${at[0] * 100}% - ${handleSize / 2}px)`,
                                top: `calc(${at[1] * 100}% - ${handleSize / 2}px)`,
                                width: handleSize,
                                height: handleSize,
                                background: '#fff',
                                border: `${hairline}px solid #8b5cf6`,
                                borderRadius: handleSize / 2,
                                cursor,
                              }}
                            />
                          ))}
                          <div
                            onPointerDown={(e) => beginDrag(e, { type: 'rotate' }, element)}
                            style={{
                              position: 'absolute',
                              left: `calc(50% - ${handleSize / 2}px)`,
                              top: -28 / scale,
                              width: handleSize,
                              height: handleSize,
                              background: '#8b5cf6',
                              borderRadius: handleSize / 2,
                              cursor: 'grab',
                            }}
                            title="Rotate (hold Shift for 15° steps)"
                          />
                        </>
                      )}
                    </div>
                  )
                })}

                {guides.v && (
                  <div
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: canvas.width / 2, borderLeft: `${hairline}px dashed #ec4899` }}
                  />
                )}
                {guides.h && (
                  <div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: canvas.height / 2, borderTop: `${hairline}px dashed #ec4899` }}
                  />
                )}

                {canvas.elements.length === 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 grid place-items-center"
                    style={{ color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(28,26,46,0.3)' }}
                  >
                    <p style={{ fontFamily: fontStack('hand'), fontSize: 56 }}>
                      Drag something onto the page
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
