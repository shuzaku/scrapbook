'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type Konva from 'konva'
import { Button } from '@/components/ui/button'
import type { Sticker, Scrapbook } from '@/lib/supabase/types'

// Konva must be loaded client-side only
const Stage = dynamic(() => import('react-konva').then((m) => m.Stage), { ssr: false })
const Layer = dynamic(() => import('react-konva').then((m) => m.Layer), { ssr: false })
const Rect = dynamic(() => import('react-konva').then((m) => m.Rect), { ssr: false })
const KonvaImage = dynamic(() => import('./KonvaImage'), { ssr: false })
const TransformerWrapper = dynamic(() => import('./TransformerWrapper'), { ssr: false })

const CANVAS_W = 1200
const CANVAS_H = 900
const BG_COLORS = ['#0a0a0f', '#1a0a2e', '#0f1a2e', '#1a1a0a', '#1a0a0a', '#f5f0e8']

interface PlacedSticker {
  id: string
  stickerId: string
  imageUrl: string
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
}

interface Props {
  scrapbook: Scrapbook
  onSave?: (canvasState: unknown) => void
}

export default function ScrapbookEditor({ scrapbook, onSave }: Props) {
  const [placed, setPlaced] = useState<PlacedSticker[]>(() => {
    if (!scrapbook.canvas_state) return []
    const state = scrapbook.canvas_state as { placed?: PlacedSticker[]; bgColor?: string }
    return state.placed ?? []
  })
  const [bgColor, setBgColor] = useState<string>(() => {
    const state = scrapbook.canvas_state as { bgColor?: string } | null
    return state?.bgColor ?? BG_COLORS[0]
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<PlacedSticker[][]>([[]])
  const [historyIdx, setHistoryIdx] = useState(0)
  const stageRef = useRef<Konva.Stage>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function pushHistory(next: PlacedSticker[]) {
    const newHistory = history.slice(0, historyIdx + 1)
    newHistory.push(next)
    setHistory(newHistory)
    setHistoryIdx(newHistory.length - 1)
  }

  function undo() {
    if (historyIdx <= 0) return
    const prev = history[historyIdx - 1]
    setPlaced(prev)
    setHistoryIdx(historyIdx - 1)
  }

  function redo() {
    if (historyIdx >= history.length - 1) return
    const next = history[historyIdx + 1]
    setPlaced(next)
    setHistoryIdx(historyIdx + 1)
  }

  const autoSave = useCallback((nextPlaced: PlacedSticker[], nextBg: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      const state = { placed: nextPlaced, bgColor: nextBg }
      onSave?.(state)
      fetch(`/api/scrapbooks/${scrapbook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas_state: state }),
      })
    }, 1000)
  }, [scrapbook.id, onSave])

  function addSticker(sticker: Sticker) {
    if (!sticker.image_url) return
    const item: PlacedSticker = {
      id: `${sticker.id}-${Date.now()}`,
      stickerId: sticker.id,
      imageUrl: sticker.image_url,
      x: CANVAS_W / 2 - 100,
      y: CANVAS_H / 2 - 100,
      scaleX: 0.5,
      scaleY: 0.5,
      rotation: 0,
    }
    const next = [...placed, item]
    pushHistory(next)
    setPlaced(next)
    autoSave(next, bgColor)
  }

  function updateItem(id: string, updates: Partial<PlacedSticker>) {
    const next = placed.map((p) => p.id === id ? { ...p, ...updates } : p)
    setPlaced(next)
    autoSave(next, bgColor)
  }

  function removeSelected() {
    if (!selectedId) return
    const next = placed.filter((p) => p.id !== selectedId)
    pushHistory(next)
    setPlaced(next)
    setSelectedId(null)
    autoSave(next, bgColor)
  }

  function changeBg(color: string) {
    setBgColor(color)
    autoSave(placed, color)
  }

  function exportPng() {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 3 })
    const a = document.createElement('a')
    a.download = `scrapbook-${scrapbook.month_key}.png`
    a.href = dataUrl
    a.click()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo() }
      if (e.key === 'Backspace' || e.key === 'Delete') removeSelected()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, historyIdx, history])

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={undo} disabled={historyIdx <= 0}>↩ Undo</Button>
        <Button variant="outline" size="sm" onClick={redo} disabled={historyIdx >= history.length - 1}>↪ Redo</Button>
        {selectedId && (
          <Button variant="destructive" size="sm" onClick={removeSelected}>🗑 Delete</Button>
        )}
        <div className="flex items-center gap-1 ml-2">
          {BG_COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${bgColor === c ? 'border-violet-400 scale-110' : 'border-white/20'}`}
              style={{ background: c }}
              onClick={() => changeBg(c)}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPng}>⬇ Export PNG</Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="overflow-auto rounded-xl border border-white/10 bg-black/40">
        <Stage
          ref={stageRef as React.RefObject<Konva.Stage>}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ cursor: 'default' }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelectedId(null)
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={bgColor} />
          </Layer>
          <Layer>
            {placed.map((item) => (
              <KonvaImage
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
                onChange={(updates) => updateItem(item.id, updates)}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      <p className="text-xs text-white/30 text-center">
        Click a sticker in the gallery to add it · Drag to move · Handles to resize/rotate · ⌘Z to undo
      </p>
    </div>
  )
}

// Expose addSticker so parent can call it
ScrapbookEditor.addStickerRef = null as ((s: Sticker) => void) | null
