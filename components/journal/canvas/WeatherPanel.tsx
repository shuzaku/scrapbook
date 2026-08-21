'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { describe, type DayWeather, type Place, type Unit } from '@/lib/weather/openmeteo'
import type { WeatherSeed } from '@/lib/journal/canvas'
import type { WeatherDisplay } from '@/lib/journal/types'

/**
 * What the weather was on the day this entry is about.
 *
 * The date comes from the entry, so all this needs is somewhere to look up.
 * Open-Meteo does both the place lookup and the weather, neither of which
 * needs a key — so this works even without the Google Maps one.
 */

interface Props {
  /** The entry's own date, as yyyy-mm-dd. */
  entryDate: string
  /** Filled in when a suggestion sends you here. */
  initialQuery?: string
  onAdd: (seed: WeatherSeed) => void
}

export default function WeatherPanel({ entryDate, initialQuery, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [found, setFound] = useState<{ place: Place; weather: DayWeather } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unit, setUnit] = useState<Unit>('c')
  const [display, setDisplay] = useState<WeatherDisplay>('tag')

  const day = entryDate.slice(0, 10)

  useEffect(() => {
    if (!initialQuery) return
    // Deferred a tick: setting state straight from an effect re-renders
    // mid-commit.
    const id = setTimeout(() => {
      setQuery(initialQuery)
      look(initialQuery)
    }, 0)
    return () => clearTimeout(id)
    // Only when a suggestion sends a new query through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  async function look(term = query) {
    const q = term.trim()
    if (!q) return

    setBusy(true)
    setError(null)
    setFound(null)
    try {
      const res = await fetch(`/api/weather?place=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not find that place')
      setPlaces(data.places as Place[])
      if ((data.places as Place[]).length === 0) setError('No place by that name')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that place')
    } finally {
      setBusy(false)
    }
  }

  async function fetchFor(place: Place, chosen: Unit = unit) {
    setBusy(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        lat: String(place.latitude),
        lon: String(place.longitude),
        date: day,
        unit: chosen,
      })
      const res = await fetch(`/api/weather?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No weather for that day')

      setFound({ place, weather: data.weather as DayWeather })
      setPlaces(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No weather for that day')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest text-white/40">Weather that day</p>
        <div className="flex gap-1">
          {(['c', 'f'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setUnit(option)
                if (found) fetchFor(found.place, option)
              }}
              className={`rounded px-1.5 py-0.5 text-[11px] uppercase transition-colors ${
                unit === option ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              °{option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              look()
            }
          }}
          placeholder="Town or city"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-400/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => look()}
          disabled={busy || !query.trim()}
          className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {busy ? '…' : 'Look'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          {error}
        </p>
      )}

      {places && places.length > 0 && (
        <div className="space-y-1">
          {places.map((place) => (
            <button
              key={`${place.latitude},${place.longitude}`}
              type="button"
              onClick={() => fetchFor(place)}
              disabled={busy}
              className="block w-full truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {place.label}
            </button>
          ))}
        </div>
      )}

      {found && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{describe(found.weather.code).icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/85">
                {found.weather.high === null ? '—' : Math.round(found.weather.high)}° /{' '}
                {found.weather.low === null ? '—' : Math.round(found.weather.low)}°{' '}
                <span className="text-white/45">{describe(found.weather.code).label}</span>
              </p>
              <p className="truncate text-xs text-white/45">
                {found.place.label} · {format(new Date(`${day}T12:00:00`), 'd MMM yyyy')}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {(['tag', 'card'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDisplay(option)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                  display === option
                    ? 'border-violet-400/60 bg-violet-500/20 text-white'
                    : 'border-white/15 text-white/60 hover:bg-white/10'
                }`}
              >
                {option === 'tag' ? 'One line' : 'Little card'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              onAdd({
                display,
                place: found.place.label,
                date: found.weather.date,
                high: found.weather.high,
                low: found.weather.low,
                code: found.weather.code,
                precip: found.weather.precip,
                unit: found.weather.unit,
              })
            }
            className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/85 transition-colors hover:bg-white/20"
          >
            Put it on the page
          </button>
        </div>
      )}

      {!places && !found && (
        <p className="text-[11px] leading-relaxed text-white/40">
          Uses this entry&rsquo;s date — {format(new Date(`${day}T12:00:00`), 'd MMM yyyy')} — and
          the real record for that day, not a forecast. No key needed.
        </p>
      )}
    </div>
  )
}
