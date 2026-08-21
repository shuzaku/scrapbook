'use client'

import { useState } from 'react'
import { PROVIDER_LABEL, parseEmbedUrl } from '@/lib/embeds/providers'
import type { EmbedSeed } from '@/lib/journal/canvas'

/**
 * Puts something from elsewhere on the page by pasting its address.
 *
 * Instagram posts, YouTube videos and tweets all frame without a key. The
 * limits are worth saying plainly rather than letting someone discover them
 * with an empty box on a finished page, so they're printed under the field.
 */

interface Props {
  onAdd: (seed: EmbedSeed) => void
}

export default function EmbedPost({ onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  function add() {
    const parsed = parseEmbedUrl(value)
    if (!parsed) {
      setError('That link isn’t one of the three — copy it from the share menu.')
      return
    }

    onAdd(parsed)
    setValue('')
    setError(null)
    setAdded(PROVIDER_LABEL[parsed.provider])
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        ▶ {open ? 'Hide embeds' : 'Embed a video or post'}
      </button>

      {open && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
                setAdded(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
              placeholder="Paste a YouTube, X or Instagram link"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              disabled={!value.trim()}
              className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {error}
            </p>
          )}

          {added && (
            <p className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-100">
              {added} added to the page.
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-white/40">
            Works with <strong className="text-white/60">public</strong> things only — a private
            account&rsquo;s post or an unlisted video won&rsquo;t show. A YouTube link keeps its
            start time if it has one.
          </p>

          <p className="text-[11px] leading-relaxed text-white/40">
            Unlike a photo, an embed stays where it is rather than being saved here: if it&rsquo;s
            taken down the frame goes blank. For something that lasts, save the picture and upload
            it.
          </p>
        </div>
      )}
    </div>
  )
}
