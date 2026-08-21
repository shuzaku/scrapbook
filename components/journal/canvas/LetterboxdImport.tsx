'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import type { Watch } from '@/lib/letterboxd/feed'
import type { MediaSeed } from '@/lib/journal/canvas'
import type { MediaDisplay } from '@/lib/journal/types'

/**
 * Films you've actually watched, from your Letterboxd feed.
 *
 * The Shelf search finds any film; this finds *yours*, with your own star
 * rating and the date you saw it. Letterboxd's real API is approval-only, but
 * the member RSS feed is public and needs nothing.
 */

/** Remembering the name saves retyping it every time. */
const REMEMBERED = 'scrapbook:letterboxd-user'

interface Props {
  display: MediaDisplay
  onAdd: (seed: MediaSeed) => void
}

export default function LetterboxdImport({ display, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState('')
  const [watches, setWatches] = useState<Watch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Deferred a tick: setting state straight from an effect re-renders
    // mid-commit.
    const id = setTimeout(() => {
      const saved = window.localStorage.getItem(REMEMBERED)
      if (saved) setUser(saved)
    }, 0)
    return () => clearTimeout(id)
  }, [])

  async function load() {
    const name = user.trim()
    if (!name) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/letterboxd/recent?user=${encodeURIComponent(name)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read that feed')

      setWatches(data.watches as Watch[])
      window.localStorage.setItem(REMEMBERED, data.user as string)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that feed')
    } finally {
      setLoading(false)
    }
  }

  async function add(watch: Watch) {
    setBusy(watch.id)
    setError(null)

    try {
      let image = ''
      if (watch.posterUrl) {
        const res = await fetch('/api/music/art', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artUrl: watch.posterUrl }),
        })
        const data = await res.json()
        if (res.ok) image = data.image as string
      }

      onAdd({
        medium: 'film',
        display,
        title: watch.title,
        creator: '',
        year: watch.year,
        detail: watch.watchedAt
          ? `${watch.rewatch ? 'rewatched' : 'watched'} ${format(
              new Date(`${watch.watchedAt}T12:00:00`),
              'd MMM'
            )}`
          : '',
        // Star ratings are out of five; everything else on a shelf card is out
        // of ten, so it's doubled to match.
        rating: watch.rating === null ? '' : (watch.rating * 2).toFixed(1),
        url: watch.url,
        image,
      })
    } catch {
      setError('Could not add that film')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        🎞 {open ? 'Hide Letterboxd' : 'Films you watched'}
      </button>

      {open && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  load()
                }
              }}
              placeholder="Letterboxd username"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={load}
              disabled={loading || !user.trim()}
              className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
            >
              {loading ? '…' : 'Load'}
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {error}
            </p>
          )}

          {watches && watches.length === 0 && (
            <p className="text-xs leading-relaxed text-white/40">
              Nothing logged on that account yet.
            </p>
          )}

          {watches && watches.length > 0 && (
            <div className="space-y-1.5">
              {watches.map((watch) => (
                <button
                  key={watch.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => add(watch)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  {watch.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Letterboxd's own poster host
                    <img
                      src={watch.posterUrl}
                      alt=""
                      className="h-12 w-8 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-8 shrink-0 place-items-center rounded-sm bg-white/10 text-xs">
                      🎬
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white/85">
                      {watch.title}
                      {watch.year && <span className="text-white/40"> {watch.year}</span>}
                    </span>
                    <span className="block truncate text-xs text-white/45">
                      {[
                        watch.watchedAt &&
                          format(new Date(`${watch.watchedAt}T12:00:00`), 'd MMM yyyy'),
                        watch.rewatch ? 'rewatch' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {watch.rating !== null && (
                    <span className="shrink-0 text-xs text-white/50">
                      {'★'.repeat(Math.floor(watch.rating))}
                      {watch.rating % 1 ? '½' : ''}
                    </span>
                  )}
                  {busy === watch.id && <span className="shrink-0 text-xs text-white/50">…</span>}
                </button>
              ))}
            </div>
          )}

          {!watches && (
            <p className="text-[11px] leading-relaxed text-white/40">
              Reads the public RSS feed at <span className="text-white/55">letterboxd.com/you/rss</span>
              . Your star rating and the date you watched come across with the film.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
