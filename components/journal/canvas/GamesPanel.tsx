'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import type { GameSeed } from '@/lib/journal/canvas'
import type { GameDisplay } from '@/lib/journal/types'

/**
 * Games on the page.
 *
 * Searching the store, its screenshots and achievement rarity all need nothing
 * at all — no key, no sign-in. Signing in through Steam adds what you actually
 * played and which achievements you unlocked.
 */

interface Game {
  appId: number
  name: string
  boxArt: string
  headerArt: string
  url: string
  minutesRecent: number | null
  minutesTotal: number | null
}

interface Achievement {
  key: string
  name: string
  description: string
  icon: string
  unlockedAt: string
  percent: number | null
}

interface Screenshot {
  id: number
  thumb: string
  full: string
}

interface Props {
  entryId: string
  state: 'unconfigured' | 'disconnected' | 'connected'
  onAdd: (seed: GameSeed) => void
  /** Screenshots go on as ordinary photos, so they frame and caption like one. */
  onAddPhoto: (photoName: string) => void
}

const FIELD =
  'h-8 w-full rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'

export default function GamesPanel({ entryId, state, onAdd, onAddPhoto }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Game[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [recent, setRecent] = useState<Game[] | null>(null)
  const [recentHint, setRecentHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Achievements and screenshots load per game, on demand.
  const [openGame, setOpenGame] = useState<number | null>(null)
  const [achievements, setAchievements] = useState<Achievement[] | null>(null)
  const [achievementHint, setAchievementHint] = useState<string | null>(null)
  const [shotsFor, setShotsFor] = useState<number | null>(null)
  const [shots, setShots] = useState<Screenshot[] | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/steam/recent')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read your recent games')
      setRecent(data.games as Game[])
      setRecentHint(data.hint ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read your recent games')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (state !== 'connected') return
    // Deferred a tick: setting state synchronously inside an effect makes
    // React re-render mid-commit.
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [state, load])

  async function search() {
    const text = query.trim()
    if (!text) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(text)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Game search failed')
      setFound(data.games as Game[])
    } catch (err) {
      setFound(null)
      setError(err instanceof Error ? err.message : 'Game search failed')
    } finally {
      setSearching(false)
    }
  }

  async function openAchievements(game: Game) {
    if (openGame === game.appId) {
      setOpenGame(null)
      return
    }
    setOpenGame(game.appId)
    setAchievements(null)
    setAchievementHint(null)
    try {
      const res = await fetch(`/api/integrations/steam/achievements?appid=${game.appId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read achievements')
      setAchievements(data.achievements as Achievement[])
      setAchievementHint(data.hint ?? null)
    } catch (err) {
      setAchievementHint(err instanceof Error ? err.message : 'Could not read achievements')
    }
  }

  async function openScreenshots(game: Game) {
    if (shotsFor === game.appId) {
      setShotsFor(null)
      return
    }
    setShotsFor(game.appId)
    setShots(null)
    try {
      const res = await fetch(`/api/steam/screenshots?appid=${game.appId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read screenshots')
      setShots(data.screenshots as Screenshot[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read screenshots')
      setShots([])
    }
  }

  /**
   * Stores artwork server-side, so the page keeps it. Passing an entry puts it
   * in that entry's photo tray too, which is right for screenshots and wrong
   * for sticker art.
   */
  async function storeArt(artUrl: string, forTray = false): Promise<string> {
    const res = await fetch('/api/music/art', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artUrl, ...(forTray ? { entryId } : {}) }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Could not fetch that artwork')
    return data.image as string
  }

  async function place(key: string, artUrl: string, seed: Omit<GameSeed, 'image'>) {
    setBusy(key)
    setError(null)
    try {
      onAdd({ ...seed, image: await storeArt(artUrl) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that')
    } finally {
      setBusy(null)
    }
  }

  async function addScreenshot(shot: Screenshot) {
    setBusy(`shot-${shot.id}`)
    setError(null)
    try {
      onAddPhoto(await storeArt(shot.full, true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that')
    } finally {
      setBusy(null)
    }
  }

  function addGame(game: Game, display: GameDisplay) {
    place(`${game.appId}-${display}`, display === 'cover' ? game.boxArt : game.headerArt, {
      display,
      name: game.name,
      appId: game.appId,
      minutes: game.minutesRecent,
      minutesTotal: game.minutesTotal,
      url: game.url,
      achievement: '',
      achievementNote: '',
      unlockedAt: '',
      rarity: null,
    })
  }

  function addAchievement(game: Game, achievement: Achievement) {
    if (!achievement.icon) {
      setError('That achievement has no icon to show.')
      return
    }
    place(`${game.appId}-${achievement.key}`, achievement.icon, {
      display: 'achievement',
      name: game.name,
      appId: game.appId,
      minutes: null,
      minutesTotal: null,
      url: game.url,
      achievement: achievement.name,
      achievementNote: achievement.description,
      unlockedAt: achievement.unlockedAt,
      rarity: achievement.percent,
    })
  }

  function GameRow({ game, withAchievements }: { game: Game; withAchievements: boolean }) {
    const recentHours = game.minutesRecent !== null ? (game.minutesRecent / 60).toFixed(1) : null
    const totalHours = game.minutesTotal !== null ? Math.round(game.minutesTotal / 60) : null

    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- Steam's own CDN */}
          <img src={game.boxArt} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-white/85">{game.name}</p>
            {(totalHours !== null || recentHours) && (
              <p className="text-[11px] text-white/45">
                {totalHours !== null && <span className="text-white/65">{totalHours}h total</span>}
                {totalHours !== null && recentHours ? ' · ' : ''}
                {recentHours && `${recentHours}h this fortnight`}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => addGame(game, 'cover')}
            className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-[#66c0f4]/25 hover:text-white disabled:opacity-40"
          >
            {busy === `${game.appId}-cover` ? '…' : 'Box art'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => addGame(game, 'card')}
            className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-[#66c0f4]/25 hover:text-white disabled:opacity-40"
          >
            {busy === `${game.appId}-card` ? '…' : 'Card'}
          </button>
        </div>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => openScreenshots(game)}
            className="text-[11px] text-white/50 underline underline-offset-2 hover:text-white"
          >
            {shotsFor === game.appId ? 'Hide screenshots' : 'Screenshots'}
          </button>
          {withAchievements && (
            <button
              type="button"
              onClick={() => openAchievements(game)}
              className="text-[11px] text-white/50 underline underline-offset-2 hover:text-white"
            >
              {openGame === game.appId ? 'Hide achievements' : 'Achievements'}
            </button>
          )}
        </div>

        {shotsFor === game.appId && (
          <div className="mt-2 space-y-1.5">
            {!shots && <p className="text-[11px] text-white/35">Loading…</p>}
            {shots && shots.length === 0 && (
              <p className="text-[11px] text-white/35">No screenshots on that store page.</p>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {(shots ?? []).map((shot) => (
                <button
                  key={shot.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => addScreenshot(shot)}
                  title="Add as a photo"
                  className="overflow-hidden rounded border border-white/10 transition-transform hover:scale-105 disabled:opacity-40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Steam's own CDN */}
                  <img src={shot.thumb} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {withAchievements && openGame === game.appId && (
          <div className="mt-2 space-y-1">
            {!achievements && !achievementHint && (
              <p className="text-[11px] text-white/35">Loading…</p>
            )}
            {achievementHint && (
              <p className="text-[11px] leading-relaxed text-amber-200/80">{achievementHint}</p>
            )}
            {(achievements ?? []).map((achievement) => (
              <button
                key={achievement.key}
                type="button"
                disabled={busy !== null}
                onClick={() => addAchievement(game, achievement)}
                title={achievement.description}
                className="flex w-full items-center gap-2 rounded-md bg-white/5 p-1.5 text-left transition-colors hover:bg-[#66c0f4]/25 disabled:opacity-40"
              >
                {achievement.icon && (
                  // eslint-disable-next-line @next/next/no-img-element -- Steam's own CDN
                  <img src={achievement.icon} alt="" className="h-6 w-6 shrink-0 rounded" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-white/80">
                    {achievement.name}
                  </span>
                  <span className="block truncate text-[10px] text-white/35">
                    {achievement.unlockedAt &&
                      format(new Date(achievement.unlockedAt), 'd MMM yyyy')}
                    {achievement.percent !== null && (
                      <span className={achievement.percent < 10 ? 'text-amber-300/80' : ''}>
                        {achievement.unlockedAt ? ' · ' : ''}
                        {achievement.percent.toFixed(1)}% of players
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search: works with nothing set up. */}
      <div className="space-y-2">
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
            placeholder="Game name"
            maxLength={200}
            className={`${FIELD} flex-1`}
          />
          <button
            type="button"
            onClick={search}
            disabled={searching || query.trim().length === 0}
            className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {searching ? '…' : 'Find'}
          </button>
        </div>

        {found && found.length === 0 && (
          <p className="text-xs text-white/40">Nothing found for that.</p>
        )}

        <div className="space-y-1.5">
          {(found ?? []).map((game) => (
            <GameRow key={game.appId} game={game} withAchievements={state === 'connected'} />
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
          {error}
        </p>
      )}

      {state === 'connected' && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-widest text-white/40">Recently played</p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="text-xs text-white/45 underline underline-offset-2 hover:text-white disabled:opacity-40"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {recentHint && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {recentHint}
            </p>
          )}

          <div className="space-y-1.5">
            {(recent ?? []).map((game) => (
              <GameRow key={game.appId} game={game} withAchievements />
            ))}
          </div>
        </div>
      )}

      {state === 'disconnected' && (
        <a
          href={`/api/integrations/steam/start?returnTo=/entry/${entryId}/design`}
          className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          Sign in through Steam for your games
        </a>
      )}

      {state === 'unconfigured' && (
        <a
          href="/settings/integrations"
          className="block text-xs text-white/40 underline underline-offset-2 hover:text-white/70"
        >
          Set up Steam for recently played and achievements
        </a>
      )}
    </div>
  )
}
