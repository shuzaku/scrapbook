'use client'

import { useEffect, useState } from 'react'
import type { PlaceResult } from '@/lib/google/maps-shared'
import type { PlaceSeed } from '@/lib/journal/canvas'
import type { PlaceDisplay } from '@/lib/journal/types'

/**
 * Looks up a shop, restaurant or landmark and sticks it on the page — as a
 * map cut-out, a pin badge, or a scannable code. All three link to the place
 * on Google Maps when the finished page is read.
 */

interface Props {
  configured: boolean
  /** Filled in when a suggestion sends you here. */
  initialQuery?: string
  onAdd: (seed: PlaceSeed) => void
}

const CHOICES: { display: PlaceDisplay; icon: string; label: string; hint: string }[] = [
  { display: 'pin', icon: '📍', label: 'Pin', hint: 'A little badge with the name' },
  { display: 'map', icon: '🗺', label: 'Map', hint: 'A map cut-out of the spot' },
  { display: 'qr', icon: '▦', label: 'Code', hint: 'Scan it to open the place' },
]

export default function PlaceSearch({ configured, initialQuery, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [exact, setExact] = useState(true)
  const [chosen, setChosen] = useState<PlaceResult | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!initialQuery) return
    // Deferred a tick: setting state straight from an effect re-renders
    // mid-commit.
    const id = setTimeout(() => {
      setQuery(initialQuery)
      search(initialQuery)
    }, 0)
    return () => clearTimeout(id)
    // Only re-runs when a suggestion sends a new query through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  if (!configured) {
    return (
      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-white/40">
          Look up a restaurant, a shop, a beach — and stick it on the page as a pin, a map, or a
          code you can scan to open it in Google Maps.
        </p>
        <a
          href="/settings/integrations"
          className="block text-xs text-white/40 underline underline-offset-2 hover:text-white/70"
        >
          Set up Google Maps
        </a>
      </div>
    )
  }

  async function search(term = query) {
    const text = query.trim()
    if (!text) return

    setBusy('search')
    setError(null)
    setChosen(null)
    try {
      const res = await fetch('/api/integrations/google/maps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not look that up')
      setResults(data.results as PlaceResult[])
      setExact(data.exact !== false)
    } catch (err) {
      setResults(null)
      setError(err instanceof Error ? err.message : 'Could not look that up')
    } finally {
      setBusy(null)
    }
  }

  /** Fetches whatever picture the chosen sticker needs, then adds it. */
  async function add(place: PlaceResult, display: PlaceDisplay) {
    setBusy(display)
    setError(null)

    const centre = place.lat !== null && place.lng !== null
      ? `${place.lat},${place.lng}`
      : [place.name, place.address].filter(Boolean).join(', ')

    try {
      const seed: PlaceSeed = {
        display,
        name: place.name,
        address: place.address,
        mapsUrl: place.mapsUrl,
        centre,
        zoom: 15,
        style: 'roadmap',
        mapImage: '',
        qrImage: '',
      }

      if (display === 'map') {
        const res = await fetch('/api/integrations/google/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'map', centre, zoom: seed.zoom, style: seed.style }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not fetch that map')
        seed.mapImage = data.image
      }

      if (display === 'qr') {
        const res = await fetch('/api/integrations/google/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'qr', url: place.mapsUrl }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not make that code')
        seed.qrImage = data.image
      }

      onAdd(seed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              search()
            }
          }}
          placeholder="Joe's Pizza, Brooklyn"
          maxLength={200}
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        />
        <button
          type="button"
          onClick={() => search()}
          disabled={busy !== null || query.trim().length === 0}
          className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {busy === 'search' ? '…' : 'Find'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
          {error}
        </p>
      )}

      {results && !exact && (
        <p className="text-xs leading-relaxed text-amber-200/80">
          Place search isn’t switched on for this key, so this is a plain Maps search rather than
          one exact spot. Enable the Places API for named results.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((place, i) => {
            const selected = chosen?.mapsUrl === place.mapsUrl && chosen?.name === place.name
            return (
              <div key={`${place.id}-${i}`} className="rounded-lg border border-white/10 bg-white/5">
                <button
                  type="button"
                  onClick={() => setChosen(selected ? null : place)}
                  className="block w-full px-3 py-2 text-left"
                >
                  <span className="block truncate text-sm text-white/85">{place.name}</span>
                  {place.address && (
                    <span className="block truncate text-xs text-white/45">{place.address}</span>
                  )}
                </button>

                {selected && (
                  <div className="grid grid-cols-3 gap-1.5 border-t border-white/10 p-2">
                    {CHOICES.map((choice) => (
                      <button
                        key={choice.display}
                        type="button"
                        title={choice.hint}
                        disabled={busy !== null}
                        onClick={() => add(place, choice.display)}
                        className="flex flex-col items-center gap-1 rounded-md bg-white/5 px-1 py-2 text-[11px] text-white/70 transition-colors hover:bg-violet-500/25 hover:text-white disabled:opacity-40"
                      >
                        <span className="text-base leading-none">
                          {busy === choice.display ? '…' : choice.icon}
                        </span>
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {results && results.length === 0 && (
        <p className="text-xs text-white/40">Nothing found for that.</p>
      )}
    </div>
  )
}
