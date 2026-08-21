'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import type { Workout } from '@/lib/strava/api'
import { decode, simplify, toPath } from '@/lib/strava/polyline'
import type { WorkoutSeed } from '@/lib/journal/canvas'
import type { WorkoutDisplay } from '@/lib/journal/types'

/**
 * Recent activities from Strava.
 *
 * The route comes as an encoded polyline, so the little previews here are the
 * same vector drawing the sticker uses — nothing is downloaded, and nothing
 * needs a map key.
 */

interface Props {
  state: 'unconfigured' | 'disconnected' | 'connected'
  onAdd: (seed: WorkoutSeed) => void
}

export default function WorkoutsPanel({ state, onAdd }: Props) {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [display, setDisplay] = useState<WorkoutDisplay>('route')
  const [unit, setUnit] = useState<'km' | 'mi'>('km')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/strava/recent')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read your activities')
      setWorkouts(data.workouts as Workout[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read your activities')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (state !== 'connected') return
    // Deferred a tick: setting state straight from an effect re-renders
    // mid-commit.
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [state, load])

  if (state === 'unconfigured') {
    return (
      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-white/50">
          Strava can put your runs and rides on a page — the route drawn from the ride itself,
          with the distance and time.
        </p>
        <a
          href="/settings/integrations"
          className="block text-xs text-white/40 underline underline-offset-2 hover:text-white/70"
        >
          Set up Strava
        </a>
      </div>
    )
  }

  if (state === 'disconnected') {
    return (
      <a
        href="/api/integrations/strava/start?returnTo=/settings/integrations"
        className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        Connect Strava
      </a>
    )
  }

  const far = (metres: number) =>
    unit === 'mi' ? `${(metres / 1609.34).toFixed(2)} mi` : `${(metres / 1000).toFixed(2)} km`

  const clock = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['km', 'mi'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setUnit(option)}
              className={`rounded px-1.5 py-0.5 text-[11px] uppercase transition-colors ${
                unit === option ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-white/45 underline underline-offset-2 hover:text-white disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="flex gap-1.5">
        {(['route', 'card'] as const).map((option) => (
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
            {option === 'route' ? 'Just the route' : 'Route + numbers'}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          {error}
        </p>
      )}

      {workouts && workouts.length === 0 && (
        <p className="text-xs leading-relaxed text-white/40">
          Nothing recorded on Strava yet.
        </p>
      )}

      <div className="space-y-1.5">
        {(workouts ?? []).map((workout) => {
          const path = workout.polyline
            ? toPath(simplify(decode(workout.polyline)), 48, 48, 4)
            : ''

          return (
            <button
              key={workout.id}
              type="button"
              onClick={() =>
                onAdd({
                  display,
                  name: workout.name,
                  sport: workout.sport,
                  distance: workout.distance,
                  movingTime: workout.movingTime,
                  elevation: workout.elevation,
                  startedAt: workout.startedAt ?? '',
                  polyline: workout.polyline,
                  url: workout.url,
                  unit,
                })
              }
              className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors hover:bg-white/10"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-black/30">
                {path ? (
                  <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
                    <path
                      d={path}
                      fill="none"
                      stroke="#fc4c02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-sm">🏃</span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white/85">{workout.name}</span>
                <span className="block truncate text-xs text-white/45">
                  {[
                    far(workout.distance),
                    clock(workout.movingTime),
                    workout.startedAt && format(new Date(workout.startedAt), 'd MMM'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {workouts && workouts.some((workout) => !workout.polyline) && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Indoor sessions have no route, so those show the sport instead.
        </p>
      )}
    </div>
  )
}
