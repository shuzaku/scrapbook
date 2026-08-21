'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { monthKeyToLabel } from '@/lib/month-key'
import type { Sticker } from '@/lib/supabase/types'

interface Props {
  monthKey: string
  onAddToCanvas?: (sticker: Sticker) => void
}

export default function StickerGallery({ monthKey, onAddToCanvas }: Props) {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch(`/api/stickers?month=${monthKey}`)
    if (res.ok) setStickers(await res.json())
  }

  useEffect(() => { load() }, [monthKey])

  async function triggerSync() {
    setSyncing(true)
    setMessage('')
    const res = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey }),
    })
    const data = await res.json()
    setMessage(`Syncing ${data.enqueued} service${data.enqueued !== 1 ? 's' : ''}… Stickers will appear shortly.`)
    setSyncing(false)
    setTimeout(load, 5000)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Stickers — {monthKeyToLabel(monthKey)}</CardTitle>
        <Button size="sm" onClick={triggerSync} disabled={syncing}>
          {syncing ? 'Syncing…' : '↻ Sync'}
        </Button>
      </CardHeader>
      <CardContent>
        {message && <p className="text-sm text-violet-300 mb-4">{message}</p>}
        {stickers.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">No stickers yet. Connect a service and click Sync.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {stickers.map((sticker) => (
              <div
                key={sticker.id}
                className="group relative rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-violet-500/60 transition-colors"
                onClick={() => onAddToCanvas?.(sticker)}
              >
                {sticker.image_url ? (
                  <img src={sticker.image_url} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-white/5 flex items-center justify-center text-white/30 text-xs">
                    Generating…
                  </div>
                )}
                {onAddToCanvas && (
                  <div className="absolute inset-0 bg-violet-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">+ Add to canvas</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
