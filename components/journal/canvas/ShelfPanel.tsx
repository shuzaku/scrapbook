'use client'

import { useEffect, useState } from 'react'
import { MEDIA, type MediaResult, type Medium } from '@/lib/media/types'
import type { MediaSeed } from '@/lib/journal/canvas'
import type { MediaDisplay } from '@/lib/journal/types'
import LetterboxdImport from './LetterboxdImport'

/**
 * Looks up a book, film, anime or manga and puts it on the page.
 *
 * Three services behind the four buttons — Open Library, Cinemeta and AniList
 * — none of which needs a key, so the whole tab works the moment the app
 * starts. The cover is downloaded and stored locally, so a finished page keeps
 * its picture with no network.
 */

interface Props {
  /** Filled in when a suggestion sends you here. */
  initialQuery?: string
  /** Which of the four to look under, when a suggestion knows. */
  initialMedium?: Medium
  onAdd: (seed: MediaSeed) => void
}

export default function ShelfPanel({ initialQuery, initialMedium, onAdd }: Props) {
  const [medium, setMedium] = useState<Medium>('book')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MediaResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [display, setDisplay] = useState<MediaDisplay>('cover')

  const placeholder = MEDIA.find((entry) => entry.key === medium)?.placeholder ?? 'Search'

  useEffect(() => {
    if (!initialQuery) return
    // Deferred a tick: setting state straight from an effect re-renders
    // mid-commit.
    const id = setTimeout(() => {
      const kind = initialMedium ?? medium
      setQuery(initialQuery)
      setMedium(kind)
      search(kind, initialQuery)
    }, 0)
    return () => clearTimeout(id)
    // Only re-runs when a suggestion sends a new query through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialMedium])

  async function search(kind: Medium = medium, term = query) {
    const q = term.trim()
    if (!q) return

    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/media/search?medium=${kind}&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setResults(data.results as MediaResult[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function add(item: MediaResult) {
    setBusy(item.key)
    setError(null)

    try {
      let image = ''
      if (item.coverUrl) {
        // Stored server-side so the page owns the cover, like album art and
        // box art. Something with no picture still makes a card.
        const res = await fetch('/api/music/art', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artUrl: item.coverUrl }),
        })
        const data = await res.json()
        if (res.ok) image = data.image as string
      }

      onAdd({
        medium: item.medium,
        display,
        title: item.title,
        creator: item.creator,
        year: item.year,
        detail: item.detail,
        rating: item.rating,
        url: item.url,
        image,
      })
    } catch {
      setError('Could not add that')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1">
        {MEDIA.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setMedium(entry.key)
              setResults(null)
              setError(null)
              // Searching straight away saves retyping when you realise the
              // thing you want is a film, not a book.
              if (query.trim()) search(entry.key)
            }}
            className={`rounded-lg border px-1 py-1.5 text-xs transition-colors ${
              medium === entry.key
                ? 'border-violet-400/60 bg-violet-500/20 text-white'
                : 'border-white/15 text-white/60 hover:bg-white/10'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              search()
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => search()}
          disabled={searching || !query.trim()}
          className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {searching ? '…' : 'Find'}
        </button>
      </div>

      <div className="flex gap-1.5">
        {(['cover', 'card'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDisplay(option)}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              display === option
                ? 'border-violet-400/60 bg-violet-500/20 text-white'
                : 'border-white/15 text-white/60 hover:bg-white/10'
            }`}
          >
            {option === 'cover' ? 'Just the cover' : 'Cover + words'}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          {error}
        </p>
      )}

      {results && results.length === 0 && (
        <p className="text-xs leading-relaxed text-white/40">
          Nothing found. Try fewer words, or a different spelling.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={busy !== null}
              onClick={() => add(item)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the service's own cover host
                <img
                  src={item.coverUrl}
                  alt=""
                  className="h-12 w-8 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <span className="grid h-12 w-8 shrink-0 place-items-center rounded-sm bg-white/10 text-xs text-white/40">
                  {item.medium === 'film' ? '🎬' : '📖'}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white/85">{item.title}</span>
                <span className="block truncate text-xs text-white/45">
                  {[item.creator, item.year, item.detail].filter(Boolean).join(' · ')}
                </span>
              </span>
              {item.rating && (
                <span className="shrink-0 text-xs text-white/40">★ {item.rating}</span>
              )}
              {busy === item.key && <span className="shrink-0 text-xs text-white/50">…</span>}
            </button>
          ))}
        </div>
      )}

      <LetterboxdImport display={display} onAdd={onAdd} />

      {!results && (
        <p className="text-xs leading-relaxed text-white/40">
          Books from Open Library, films from Cinemeta, anime and manga from AniList — none of
          them need an account or a key. Covers are saved with your page, so they keep working
          offline.
        </p>
      )}
    </div>
  )
}
