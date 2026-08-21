'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import StickerGallery from '@/components/dashboard/StickerGallery'
import type { Scrapbook, Sticker } from '@/lib/supabase/types'
import { monthKeyToLabel } from '@/lib/month-key'
import dynamic from 'next/dynamic'

const ScrapbookEditor = dynamic(() => import('@/components/canvas/ScrapbookEditor'), { ssr: false })

interface Props {
  params: Promise<{ id: string }>
}

export default function EditorPage({ params }: Props) {
  const [scrapbook, setScrapbook] = useState<Scrapbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const addStickerRef = useRef<((s: Sticker) => void) | null>(null)

  useEffect(() => {
    params.then(({ id }) =>
      fetch(`/api/scrapbooks/${id}`)
        .then((r) => r.json())
        .then((data) => { setScrapbook(data); setLoading(false) })
    )
  }, [params])

  async function makePublic() {
    if (!scrapbook) return
    const res = await fetch(`/api/scrapbooks/${scrapbook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: true }),
    })
    const updated = await res.json()
    setScrapbook(updated)
    const url = `${window.location.origin}/s/${updated.share_token}`
    setShareUrl(url)
    await navigator.clipboard.writeText(url).catch(() => {})
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <p className="text-white/40">Loading…</p>
      </div>
    )
  }

  if (!scrapbook) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-white mb-4">Scrapbook not found.</p>
          <Link href="/dashboard"><Button variant="outline">Back to dashboard</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0f' }}>
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard" className="text-white/60 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-white font-semibold">{monthKeyToLabel(scrapbook.month_key)}</span>
        <div className="ml-auto flex gap-2">
          {shareUrl ? (
            <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-lg px-3 py-1.5">
              <span className="text-green-300 text-xs">Link copied!</span>
              <a href={shareUrl} target="_blank" rel="noopener" className="text-green-400 text-xs underline">Open</a>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={makePublic}>
              🔗 Share
            </Button>
          )}
        </div>
      </header>

      {/* Body: sidebar + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sticker sidebar */}
        <div className="w-64 border-r border-white/10 overflow-y-auto p-3 shrink-0">
          <StickerGallery
            monthKey={scrapbook.month_key}
            onAddToCanvas={(sticker) => addStickerRef.current?.(sticker)}
          />
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto p-6">
          <ScrapbookEditor
            scrapbook={scrapbook}
            onSave={(state) => setScrapbook((prev) => prev ? { ...prev, canvas_state: state } : prev)}
          />
        </div>
      </div>
    </div>
  )
}
