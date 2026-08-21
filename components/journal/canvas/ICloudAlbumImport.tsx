'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { AlbumPhoto } from '@/lib/icloud/sharedalbum'
import type { Photo } from '@/lib/journal/types'

/**
 * Imports pictures from a public iCloud Shared Album.
 *
 * The only keyless way into an iPhone's photos: Apple has no photos API, and
 * the Apple Music one needs a paid developer membership. A shared album's
 * public website is served by an endpoint that asks for nothing but the
 * album's own token.
 */

/** How many to show at a time — an album can hold hundreds. */
const PAGE = 24

interface Props {
  entryId: string
  onImported: (photo: Photo) => void
}

export default function ICloudAlbumImport({ entryId, onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [album, setAlbum] = useState<{ name: string; photos: AlbumPhoto[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, true>>({})
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)

  async function read() {
    const url = link.trim()
    if (!url) return

    setLoading(true)
    setError(null)
    setAlbum(null)
    setDone({})
    setShown(PAGE)

    try {
      const res = await fetch('/api/icloud/album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read that album')
      setAlbum(data as { name: string; photos: AlbumPhoto[] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that album')
    } finally {
      setLoading(false)
    }
  }

  async function bring(photo: AlbumPhoto) {
    setBusy(photo.guid)
    setError(null)

    try {
      const res = await fetch('/api/icloud/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: photo.url,
          entryId,
          caption: photo.caption,
          takenAt: photo.takenAt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not bring that across')

      onImported(data.photo as Photo)
      setDone((was) => ({ ...was, [photo.guid]: true }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not bring that across')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        ☁ {open ? 'Hide iCloud album' : 'Import from an iCloud album'}
      </button>

      {open && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  read()
                }
              }}
              placeholder="icloud.com/sharedalbum/#B0…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={read}
              disabled={loading || !link.trim()}
              className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
            >
              {loading ? '…' : 'Open'}
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {error}
            </p>
          )}

          {!album && !loading && (
            <p className="text-[11px] leading-relaxed text-white/40">
              On your iPhone: Photos → an album → the people icon → turn on{' '}
              <strong className="text-white/60">Public Website</strong>, then copy the link. Only
              that album is readable, and only while you leave sharing on.
            </p>
          )}

          {album && (
            <>
              <div className="flex items-center justify-between">
                <p className="min-w-0 truncate text-[11px] uppercase tracking-widest text-white/40">
                  {album.name || 'Shared album'} · {album.photos.length}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAlbum(null)
                    setLink('')
                  }}
                  className="shrink-0 text-xs text-white/45 underline underline-offset-2 hover:text-white"
                >
                  Another album
                </button>
              </div>

              {album.photos.length === 0 && (
                <p className="text-xs leading-relaxed text-white/40">
                  That album is empty, or holds only videos — a page takes stills.
                </p>
              )}

              <div className="grid grid-cols-3 gap-1.5">
                {album.photos.slice(0, shown).map((photo) => (
                  <button
                    key={photo.guid}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => bring(photo)}
                    title={
                      [photo.caption, photo.takenAt && format(new Date(photo.takenAt), 'd MMM yyyy')]
                        .filter(Boolean)
                        .join(' — ') || 'Add to this entry'
                    }
                    className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5 transition-transform hover:scale-105 disabled:opacity-40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Apple's signed asset host */}
                    <img
                      src={photo.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {done[photo.guid] && (
                      <span className="absolute bottom-1 right-1 rounded bg-green-500/80 px-1 text-[9px] text-white">
                        added
                      </span>
                    )}
                    {busy === photo.guid && (
                      <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs text-white">
                        …
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {shown < album.photos.length && (
                <button
                  type="button"
                  onClick={() => setShown((was) => was + PAGE)}
                  className="w-full rounded-lg border border-white/15 px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Show {Math.min(PAGE, album.photos.length - shown)} more
                </button>
              )}

              <p className="text-[11px] leading-relaxed text-white/35">
                Captions and dates come across with the picture. The album stays on iCloud — what
                you add here is copied and kept.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
