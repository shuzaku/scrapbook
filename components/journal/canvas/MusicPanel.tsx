'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { SongSeed } from '@/lib/journal/canvas'
import type { TrackResult } from '@/lib/music/itunes'
import type { SongDisplay } from '@/lib/journal/types'

/**
 * Songs on the page, three ways in.
 *
 * Searching by name is the one that always works — it needs no account at all.
 * Spotify's recently-played is better when it is available, because it knows
 * what you actually listened to and when. Typing one in by hand covers the
 * rest.
 */

interface Play {
  id: string
  title: string
  artist: string
  album: string
  artUrl: string | null
  playedAt: string
  url: string
}

interface Props {
  entryId: string
  state: 'unconfigured' | 'disconnected' | 'connected'
  /** Filled in when a suggestion sends you here. */
  initialQuery?: string
  onAdd: (seed: SongSeed) => void
}

const FIELD =
  'h-8 w-full rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'

function AddButtons({
  disabled,
  busy,
  onPick,
}: {
  disabled?: boolean
  busy: SongDisplay | null
  onPick: (display: SongDisplay) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(['card', 'art'] as SongDisplay[]).map((display) => (
        <button
          key={display}
          type="button"
          disabled={disabled}
          onClick={() => onPick(display)}
          className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white/70 transition-colors hover:bg-violet-500/25 hover:text-white disabled:opacity-40"
        >
          {busy === display ? '…' : display === 'card' ? 'Card' : 'Cover only'}
        </button>
      ))}
    </div>
  )
}

/** One track from a search or a recent play, with its two add buttons. */
function TrackRow({
  art,
  title,
  subtitle,
  aside,
  busy,
  disabled,
  onPick,
}: {
  art: string | null
  title: string
  subtitle: string
  aside?: string
  busy: SongDisplay | null
  disabled: boolean
  onPick: (display: SongDisplay) => void
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="flex items-center gap-2.5">
        {art && (
          // eslint-disable-next-line @next/next/no-img-element -- the service's own CDN
          <img src={art} alt="" className="h-10 w-10 shrink-0 rounded" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/85">{title}</p>
          <p className="truncate text-[11px] text-white/45">{subtitle}</p>
        </div>
        {aside && <span className="shrink-0 text-[10px] text-white/30">{aside}</span>}
      </div>
      <div className="mt-2">
        <AddButtons disabled={disabled} busy={busy} onPick={onPick} />
      </div>
    </div>
  )
}

export default function MusicPanel({ entryId, state, initialQuery, onAdd }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Look-up by name — no account needed.
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<TrackResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  // Spotify's recently played.
  const [plays, setPlays] = useState<Play[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [spotifyError, setSpotifyError] = useState<string | null>(null)

  // Typed in by hand.
  const [manualOpen, setManualOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [link, setLink] = useState('')
  const [coverName, setCoverName] = useState('')
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setSpotifyError(null)
    try {
      const res = await fetch('/api/integrations/spotify/recent')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not read your recent plays')
      setPlays(data.plays as Play[])
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : 'Could not read your recent plays')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (state !== 'connected') return
    // Kicked off after the effect returns: `load` sets state straight away,
    // and doing that mid-commit makes React re-render on top of itself.
    const id = setTimeout(load, 0)
    return () => clearTimeout(id)
  }, [state, load])

  /** Stores cover art on the server, so the page owns it. */
  async function fetchArt(artUrl: string | null): Promise<string> {
    if (!artUrl) return ''
    const res = await fetch('/api/music/art', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artUrl }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Could not fetch that cover')
    return data.image as string
  }

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

  async function search(term = query) {
    const text = query.trim()
    if (!text) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(text)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Song search failed')
      setTracks(data.tracks as TrackResult[])
    } catch (err) {
      setTracks(null)
      setError(err instanceof Error ? err.message : 'Song search failed')
    } finally {
      setSearching(false)
    }
  }

  async function place(
    key: string,
    display: SongDisplay,
    seed: Omit<SongSeed, 'display' | 'image'> & { artUrl: string | null }
  ) {
    setBusy(`${key}-${display}`)
    setError(null)
    try {
      const { artUrl, ...rest } = seed
      onAdd({ ...rest, display, image: await fetchArt(artUrl) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that')
    } finally {
      setBusy(null)
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return
    setError(null)
    const body = new FormData()
    body.append('file', file)
    body.append('entryId', entryId)
    // Keep it off the entry's photo tray — it belongs to the sticker.
    body.append('attach', 'false')

    const res = await fetch('/api/photos', { method: 'POST', body })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Could not upload that cover')
      return
    }
    setCoverName(data.name)
    setCoverPreview(`/api/photos/${data.name}`)
  }

  function placeManual(display: SongDisplay) {
    if (!title.trim()) {
      setError('Give the song a title.')
      return
    }
    onAdd({
      display,
      title: title.trim(),
      artist: artist.trim(),
      album: '',
      playedAt: '',
      source: 'manual',
      linkUrl: link.trim(),
      image: coverName,
    })
  }

  return (
    <div className="space-y-4">
      {/* Search: works with nothing configured. */}
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
            placeholder="Song or artist"
            maxLength={200}
            className={`${FIELD} flex-1`}
          />
          <button
            type="button"
            onClick={() => search()}
            disabled={searching || query.trim().length === 0}
            className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 text-xs text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {searching ? '…' : 'Find'}
          </button>
        </div>

        {tracks && tracks.length === 0 && (
          <p className="text-xs text-white/40">Nothing found for that.</p>
        )}

        <div className="space-y-1.5">
          {(tracks ?? []).map((track) => (
            <TrackRow
              key={track.id}
              art={track.artUrl}
              title={track.title}
              subtitle={[track.artist, track.album].filter(Boolean).join(' · ')}
              disabled={busy !== null}
              busy={
                busy === `${track.id}-card` ? 'card' : busy === `${track.id}-art` ? 'art' : null
              }
              onPick={(display) =>
                place(track.id, display, {
                  title: track.title,
                  artist: track.artist,
                  album: track.album,
                  playedAt: '',
                  source: track.source,
                  linkUrl: track.url,
                  artUrl: track.artUrl,
                })
              }
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
          {error}
        </p>
      )}

      {/* Spotify: what you actually listened to, when it is available. */}
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

          {spotifyError && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {spotifyError}
            </p>
          )}

          <div className="space-y-1.5">
            {(plays ?? []).map((play) => {
              const key = `${play.id}-${play.playedAt}`
              return (
                <TrackRow
                  key={key}
                  art={play.artUrl}
                  title={play.title}
                  subtitle={play.artist}
                  aside={play.playedAt ? format(new Date(play.playedAt), 'HH:mm') : undefined}
                  disabled={busy !== null}
                  busy={busy === `${key}-card` ? 'card' : busy === `${key}-art` ? 'art' : null}
                  onPick={(display) =>
                    place(key, display, {
                      title: play.title,
                      artist: play.artist,
                      album: play.album,
                      playedAt: play.playedAt,
                      source: 'spotify',
                      linkUrl: play.url,
                      artUrl: play.artUrl,
                    })
                  }
                />
              )
            })}
          </div>

          {plays && plays.length === 0 && (
            <p className="text-xs leading-relaxed text-white/40">
              Nothing played recently. Listen to something and hit Refresh.
            </p>
          )}
        </div>
      )}

      {state === 'disconnected' && (
        <a
          href={`/api/integrations/spotify/start?returnTo=/entry/${entryId}/design`}
          className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          Connect Spotify for recently played
        </a>
      )}

      {/* By hand: for anything search cannot find. */}
      <div className="border-t border-white/10 pt-4">
        {!manualOpen ? (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="text-xs text-white/50 underline underline-offset-2 hover:text-white"
          >
            Or type one in by hand
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-white/40">By hand</p>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title"
              maxLength={200}
              className={FIELD}
            />
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist"
              maxLength={200}
              className={FIELD}
            />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link to the track (optional)"
              maxLength={500}
              className={FIELD}
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-md border border-dashed border-white/20 px-2 py-1.5 text-[11px] text-white/60 transition-colors hover:border-violet-400/60 hover:text-white"
              >
                {coverName ? 'Change cover' : 'Add cover art (optional)'}
              </button>
              {coverPreview && (
                // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
                <img src={coverPreview} alt="" className="h-8 w-8 shrink-0 rounded" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              className="hidden"
              onChange={(e) => uploadCover(e.target.files?.[0])}
            />

            <AddButtons busy={null} onPick={placeManual} />
            <p className="text-[11px] leading-relaxed text-white/35">
              With no cover art the sticker shows the title on a plain sleeve.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
