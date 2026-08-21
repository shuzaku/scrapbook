import type { CSSProperties } from 'react'
import { format } from 'date-fns'
import { fontStack } from '@/lib/journal/canvas'
import type { CanvasElement } from '@/lib/journal/types'
import { PROVIDER_LABEL, embedSrc } from '@/lib/embeds/providers'
import { describe as describeWeather } from '@/lib/weather/openmeteo'
import { decode, simplify, toPath } from '@/lib/strava/polyline'

/**
 * Draws one element inside the page's coordinate space. Shared by the editor
 * and the read-only view so a saved page looks exactly like what you arranged.
 */

export function boxStyle(element: CanvasElement): CSSProperties {
  return {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: 'center center',
  }
}

function PhotoContent({
  element,
  photoBase,
}: {
  element: Extract<CanvasElement, { kind: 'photo' }>
  photoBase: string
}) {
  const src = `${photoBase}/${element.photo}`

  if (element.frame === 'polaroid') {
    return (
      <div
        className="flex h-full w-full flex-col bg-white p-[14px] pb-0"
        style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
        <img src={src} alt={element.caption} className="min-h-0 w-full flex-1 object-cover" />
        <div
          className="flex h-[64px] shrink-0 items-center justify-center truncate px-2 text-[26px] text-[#1c1a2e]"
          style={{ fontFamily: fontStack('hand') }}
        >
          {element.caption}
        </div>
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      style={{
        borderRadius: element.frame === 'circle' ? '50%' : element.frame === 'rounded' ? 18 : 0,
        boxShadow: element.frame === 'plain' ? 'none' : '0 8px 24px rgba(0,0,0,0.18)',
      }}
    />
  )
}

/**
 * `linkify` turns a place into a real link. Read-only views pass it; the
 * editor doesn't, where a click means "select this" instead.
 */
/** How each service is named on a sticker, matching where its link goes. */
const SOURCE_MARK: Record<string, { label: string; color: string }> = {
  spotify: { label: 'Spotify', color: '#1DB954' },
  itunes: { label: 'Apple Music', color: '#fa586a' },
  manual: { label: '', color: 'rgba(255,255,255,0.45)' },
}

/** A sleeve for a song with no cover art — typed in by hand. */
function SleeveStub({ element }: { element: Extract<CanvasElement, { kind: 'song' }> }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-md bg-[#121212] p-4 text-center"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
    >
      <span style={{ fontSize: Math.min(element.h * 0.3, 64), lineHeight: 1 }}>♪</span>
      <span
        className="line-clamp-2 font-semibold text-white"
        style={{ fontSize: Math.min(element.h * 0.11, 22) }}
      >
        {element.title}
      </span>
      {element.artist && (
        <span
          className="line-clamp-1 text-white/55"
          style={{ fontSize: Math.min(element.h * 0.09, 17) }}
        >
          {element.artist}
        </span>
      )}
    </div>
  )
}

const SHELF_SOURCE: Record<'book' | 'film' | 'anime' | 'manga', string> = {
  book: 'Open Library',
  film: 'IMDb',
  anime: 'AniList',
  manga: 'AniList',
}

export default function ElementBox({
  element,
  linkify = false,
  photoBase = '/api/photos',
}: {
  element: CanvasElement
  linkify?: boolean
  /**
   * Where pictures are served from. The default needs a session; a shared
   * page passes its own token-scoped address instead.
   */
  photoBase?: string
}) {
  const drawn = draw(element, linkify, photoBase)

  if (linkify && element.kind === 'game' && element.url) {
    return (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${element.name} on Steam`}
        className="block h-full w-full"
      >
        {drawn}
      </a>
    )
  }

  if (linkify && element.kind === 'song' && element.linkUrl) {
    return (
      <a
        href={element.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Play "${element.title}" on Spotify`}
        className="block h-full w-full"
      >
        {drawn}
      </a>
    )
  }

  if (linkify && element.kind === 'workout' && element.url) {
    return (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${element.name} on Strava`}
        className="block h-full w-full"
      >
        {drawn}
      </a>
    )
  }

  if (linkify && element.kind === 'media' && element.url) {
    return (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${element.title} on ${SHELF_SOURCE[element.medium]}`}
        className="block h-full w-full"
      >
        {drawn}
      </a>
    )
  }

  if (linkify && element.kind === 'place' && element.mapsUrl) {
    return (
      <a
        href={element.mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${element.name || 'this place'} in Google Maps`}
        className="block h-full w-full"
      >
        {drawn}
      </a>
    )
  }

  return drawn
}

function draw(element: CanvasElement, live = false, photoBase = '/api/photos') {
  switch (element.kind) {
    case 'text':
      return (
        <div
          className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
          style={{
            fontFamily: fontStack(element.font),
            fontSize: element.fontSize,
            lineHeight: 1.25,
            color: element.color,
            textAlign: element.align,
            fontWeight: element.bold ? 700 : 400,
            fontStyle: element.italic ? 'italic' : 'normal',
          }}
        >
          {element.text}
        </div>
      )

    case 'photo':
      return <PhotoContent element={element} photoBase={photoBase} />

    case 'sticker':
      return (
        <div
          className="flex h-full w-full select-none items-center justify-center"
          style={{ fontSize: Math.min(element.w, element.h) * 0.84, lineHeight: 1 }}
        >
          {element.emoji}
        </div>
      )

    case 'shape':
      return (
        <div
          className="h-full w-full"
          style={{
            backgroundColor: element.color,
            borderRadius:
              element.shape === 'ellipse' ? '50%' : element.shape === 'line' ? 9999 : 12,
          }}
        />
      )

    case 'song': {
      const played = element.playedAt ? new Date(element.playedAt) : null
      const mark = SOURCE_MARK[element.source]

      if (element.display === 'art') {
        if (!element.image) return <SleeveStub element={element} />
        // Cover art shown as served — Spotify's terms don't allow altering it.
        return (
          // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
          <img
            src={`${photoBase}/${element.image}`}
            alt={`${element.album || element.title} cover`}
            className="h-full w-full object-cover"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
          />
        )
      }

      return (
        <div
          className="flex h-full w-full items-center gap-3 overflow-hidden rounded-xl bg-[#121212] p-3"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
        >
          {element.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
            <img
              src={`${photoBase}/${element.image}`}
              alt=""
              className="h-full shrink-0 rounded-md object-cover"
              style={{ aspectRatio: '1 / 1' }}
            />
          ) : (
            <div
              className="flex h-full shrink-0 items-center justify-center rounded-md bg-white/10"
              style={{ aspectRatio: '1 / 1', fontSize: Math.min(element.h * 0.4, 40) }}
            >
              ♪
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <span
              className="truncate font-semibold text-white"
              style={{ fontSize: Math.min(element.h * 0.19, 26) }}
            >
              {element.title}
            </span>
            <span
              className="truncate text-white/60"
              style={{ fontSize: Math.min(element.h * 0.15, 20) }}
            >
              {element.artist}
            </span>
            <span
              className="mt-1 flex items-center gap-1.5 truncate"
              style={{ fontSize: Math.min(element.h * 0.12, 15), color: mark.color }}
            >
              {/* Naming the service is attribution, and keeps the mark honest
                  about where the link actually goes. */}
              {mark.label && (
                <>
                  <span
                    className="inline-block shrink-0 rounded-full"
                    style={{ width: '0.7em', height: '0.7em', backgroundColor: mark.color }}
                  />
                  {mark.label}
                </>
              )}
              {played && (
                <span className="truncate text-white/35">
                  {mark.label ? '· ' : ''}
                  {format(played, 'd MMM')}
                </span>
              )}
            </span>
          </div>
        </div>
      )
    }

    case 'game': {
      // Lifetime hours say more about a year than a fortnight does.
      const hours =
        element.minutesTotal !== null
          ? `${Math.round(element.minutesTotal / 60)}h`
          : element.minutes !== null
            ? `${(element.minutes / 60).toFixed(1)}h`
            : null

      if (element.display === 'cover') {
        return (
          // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
          <img
            src={`${photoBase}/${element.image}`}
            alt={element.name}
            className="h-full w-full rounded-md object-cover"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
          />
        )
      }

      if (element.display === 'achievement') {
        const unlocked = element.unlockedAt ? new Date(element.unlockedAt) : null
        return (
          <div
            className="flex h-full w-full items-center gap-3 overflow-hidden rounded-xl bg-[#1b2838] p-3"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
            <img
              src={`${photoBase}/${element.image}`}
              alt=""
              className="h-full shrink-0 rounded object-contain"
              style={{ aspectRatio: '1 / 1' }}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span
                className="truncate font-semibold text-[#66c0f4]"
                style={{ fontSize: Math.min(element.h * 0.22, 24) }}
              >
                {element.achievement || 'Achievement'}
              </span>
              <span
                className="truncate text-white/70"
                style={{ fontSize: Math.min(element.h * 0.16, 18) }}
              >
                {element.name}
              </span>
              {(unlocked || element.rarity !== null) && (
                <span
                  className="truncate"
                  style={{
                    fontSize: Math.min(element.h * 0.13, 15),
                    // A rare one is worth showing off.
                    color:
                      element.rarity !== null && element.rarity < 10
                        ? 'rgba(252,211,77,0.9)'
                        : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {unlocked && `unlocked ${format(unlocked, 'd MMM yyyy')}`}
                  {element.rarity !== null && (
                    <>
                      {unlocked ? ' · ' : ''}
                      {element.rarity.toFixed(1)}% of players
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        )
      }

      return (
        <div
          className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-[#1b2838]"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
          <img
            src={`${photoBase}/${element.image}`}
            alt=""
            className="min-h-0 w-full flex-1 object-cover"
          />
          <div className="flex shrink-0 items-baseline justify-between gap-2 px-3 py-2">
            <span
              className="truncate font-semibold text-white"
              style={{ fontSize: Math.min(element.h * 0.16, 22) }}
            >
              {element.name}
            </span>
            {hours && (
              <span
                className="shrink-0 text-[#66c0f4]"
                style={{ fontSize: Math.min(element.h * 0.13, 17) }}
              >
                {hours}
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'place': {
      if (element.display === 'map') {
        return (
          <div
            className="flex h-full w-full flex-col overflow-hidden bg-white p-[10px] pb-0"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
            <img
              src={`${photoBase}/${element.mapImage}`}
              alt={element.name}
              className="min-h-0 w-full flex-1 object-cover"
            />
            <div
              className="flex h-[54px] shrink-0 items-center justify-center gap-1.5 truncate px-2 text-[24px] text-[#1c1a2e]"
              style={{ fontFamily: fontStack('hand') }}
            >
              <span style={{ fontSize: 20 }}>📍</span>
              <span className="truncate">{element.name}</span>
            </div>
          </div>
        )
      }

      if (element.display === 'qr') {
        return (
          <div
            className="flex h-full w-full flex-col items-center overflow-hidden rounded-[14px] bg-white p-[10px]"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos */}
            <img
              src={`${photoBase}/${element.qrImage}`}
              alt={`Scan for ${element.name}`}
              className="min-h-0 w-full flex-1 object-contain"
            />
            <div
              className="flex h-[42px] shrink-0 items-center justify-center gap-1 truncate px-1 text-center text-[20px] leading-tight text-[#1c1a2e]"
              style={{ fontFamily: fontStack('hand') }}
            >
              <span className="truncate">{element.name}</span>
            </div>
          </div>
        )
      }

      // A pin badge: the sticker you'd stick next to a photo of the place.
      return (
        <div
          className="flex h-full w-full items-center gap-3 overflow-hidden rounded-full bg-white px-4"
          style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}
        >
          <span className="shrink-0" style={{ fontSize: Math.min(element.h * 0.5, 34) }}>
            📍
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block truncate text-[#1c1a2e]"
              style={{ fontFamily: fontStack('hand'), fontSize: Math.min(element.h * 0.42, 30) }}
            >
              {element.name}
            </span>
            {element.address && element.h > 74 && (
              <span
                className="block truncate text-[#1c1a2e]/55"
                style={{ fontSize: Math.min(element.h * 0.2, 15) }}
              >
                {element.address}
              </span>
            )}
          </span>
        </div>
      )
    }

    case 'workout': {
      const far =
        element.unit === 'mi'
          ? `${(element.distance / 1609.34).toFixed(2)} mi`
          : `${(element.distance / 1000).toFixed(2)} km`

      const clock = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const rest = Math.floor(seconds % 60)
        return hours > 0
          ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
          : `${minutes}:${String(rest).padStart(2, '0')}`
      }

      // Pace is what a runner reads; a cyclist wants speed. Distance and time
      // are the only inputs either way.
      const per =
        element.distance > 0 && element.movingTime > 0
          ? element.unit === 'mi'
            ? `${clock(element.movingTime / (element.distance / 1609.34))} /mi`
            : `${clock(element.movingTime / (element.distance / 1000))} /km`
          : ''

      const box = element.display === 'route' ? { w: element.w, h: element.h } : { w: 150, h: 150 }
      const route = element.polyline
        ? toPath(simplify(decode(element.polyline)), box.w, box.h, Math.min(box.w, box.h) * 0.08)
        : ''

      const drawing = route ? (
        <svg
          viewBox={`0 0 ${box.w} ${box.h}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path
            d={route}
            fill="none"
            stroke="#fc4c02"
            strokeWidth={Math.max(Math.min(box.w, box.h) * 0.022, 2)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // An indoor session has no route; the sport reads better than an
        // empty square.
        <div className="grid h-full w-full place-items-center">
          <span
            className="font-semibold uppercase tracking-widest text-[#fc4c02]"
            style={{ fontSize: Math.min(box.h * 0.11, 15) }}
          >
            {element.sport || 'Workout'}
          </span>
        </div>
      )

      if (element.display === 'route') {
        return (
          <div
            className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[#fbf7ef]"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}
          >
            <div className="min-h-0 flex-1">{drawing}</div>
            <div
              className="flex shrink-0 items-baseline justify-between gap-2 px-3 pb-2"
              style={{ fontSize: Math.min(element.h * 0.075, 15) }}
            >
              <span className="truncate font-semibold text-neutral-700">{far}</span>
              <span className="shrink-0 text-neutral-400">{clock(element.movingTime)}</span>
            </div>
          </div>
        )
      }

      const started = element.startedAt ? new Date(element.startedAt) : null

      return (
        <div
          className="flex h-full w-full items-stretch gap-3 overflow-hidden rounded-2xl bg-[#fbf7ef] p-3"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}
        >
          <div className="h-full shrink-0" style={{ aspectRatio: '1 / 1' }}>
            {drawing}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <span
              className="line-clamp-2 font-semibold text-neutral-800"
              style={{ fontSize: Math.min(element.h * 0.15, 22) }}
            >
              {element.name}
            </span>
            <span
              className="truncate font-semibold text-[#fc4c02]"
              style={{ fontSize: Math.min(element.h * 0.17, 25) }}
            >
              {far}
            </span>
            <span
              className="truncate text-neutral-500"
              style={{ fontSize: Math.min(element.h * 0.1, 15) }}
            >
              {[clock(element.movingTime), per, element.elevation > 0 ? `\u2191${Math.round(element.elevation)}m` : null]
                .filter(Boolean)
                .join(' \u00b7 ')}
            </span>
            <span
              className="truncate text-neutral-400"
              style={{ fontSize: Math.min(element.h * 0.085, 13) }}
            >
              {[element.sport, started && format(started, 'd MMM yyyy')].filter(Boolean).join(' \u00b7 ')}
            </span>
            {element.note && (
              <span
                className="mt-1 line-clamp-2 font-serif italic text-neutral-500"
                style={{ fontSize: Math.min(element.h * 0.1, 15) }}
              >
                {element.note}
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'weather': {
      const { label, icon } = describeWeather(element.code)
      const degrees = (value: number | null) =>
        value === null ? '—' : `${Math.round(value)}\u00b0`
      const day = element.date ? new Date(`${element.date}T12:00:00`) : null

      if (element.display === 'tag') {
        return (
          <div
            className="flex h-full w-full items-center gap-2 overflow-hidden rounded-full bg-white/90 px-3"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}
          >
            <span style={{ fontSize: Math.min(element.h * 0.52, 30) }}>{icon}</span>
            <span
              className="shrink-0 font-semibold text-neutral-700"
              style={{ fontSize: Math.min(element.h * 0.38, 22) }}
            >
              {degrees(element.high)}
              <span className="text-neutral-400"> / {degrees(element.low)}</span>
            </span>
            {element.place && (
              <span
                className="truncate text-neutral-500"
                style={{ fontSize: Math.min(element.h * 0.28, 16) }}
              >
                {element.place}
              </span>
            )}
          </div>
        )
      }

      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl bg-white/90 px-3 text-center"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}
        >
          <span style={{ fontSize: Math.min(element.h * 0.3, 52) }}>{icon}</span>
          <span
            className="font-semibold text-neutral-700"
            style={{ fontSize: Math.min(element.h * 0.17, 28) }}
          >
            {degrees(element.high)}
            <span className="text-neutral-400"> / {degrees(element.low)}</span>
          </span>
          <span
            className="truncate text-neutral-500"
            style={{ fontSize: Math.min(element.h * 0.1, 16), maxWidth: '100%' }}
          >
            {label}
            {element.precip ? ` \u00b7 ${element.precip}${element.unit === 'f' ? 'in' : 'mm'}` : ''}
          </span>
          {element.place && (
            <span
              className="truncate font-serif text-neutral-600"
              style={{ fontSize: Math.min(element.h * 0.1, 16), maxWidth: '100%' }}
            >
              {element.place}
            </span>
          )}
          {day && (
            <span
              className="text-neutral-400"
              style={{ fontSize: Math.min(element.h * 0.085, 13) }}
            >
              {format(day, 'd MMM yyyy')}
            </span>
          )}
        </div>
      )
    }

    case 'media': {
      const cover = element.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
        <img
          src={`${photoBase}/${element.image}`}
          alt={`${element.title} cover`}
          className="h-full w-full object-cover"
        />
      ) : (
        // Plenty of entries have no artwork; a plain board with the title
        // reads better than a broken picture.
        <div
          className="flex h-full w-full flex-col justify-center gap-1 bg-[#f3ede3] px-3 text-center"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
        >
          <span
            className="line-clamp-4 font-serif font-semibold text-neutral-800"
            style={{ fontSize: Math.min(element.h * 0.09, 22) }}
          >
            {element.title}
          </span>
          <span
            className="line-clamp-2 font-serif text-neutral-500"
            style={{ fontSize: Math.min(element.h * 0.07, 16) }}
          >
            {element.creator}
          </span>
        </div>
      )

      if (element.display === 'cover') {
        return (
          <div
            className="h-full w-full overflow-hidden rounded-sm"
            // A book stands proud of the page with a spine-side shadow; a
            // poster is flat, so it gets the drop shadow alone.
            style={{
              boxShadow:
                element.medium === 'book'
                  ? '0 10px 26px rgba(0,0,0,0.22), inset 3px 0 6px rgba(0,0,0,0.13)'
                  : '0 10px 26px rgba(0,0,0,0.22)',
            }}
          >
            {cover}
          </div>
        )
      }

      const facts = [
        element.year || null,
        element.detail || null,
        element.rating ? `\u2605 ${element.rating}` : null,
      ].filter(Boolean)

      return (
        <div
          className="flex h-full w-full items-stretch gap-3 overflow-hidden rounded-xl bg-[#fbf7ef] p-3"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}
        >
          <div
            className="h-full shrink-0 overflow-hidden rounded-sm"
            style={{ aspectRatio: '2 / 3', boxShadow: '0 4px 10px rgba(0,0,0,0.22)' }}
          >
            {cover}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <span
              className="line-clamp-2 font-serif font-semibold text-neutral-800"
              style={{ fontSize: Math.min(element.h * 0.16, 24) }}
            >
              {element.title}
            </span>
            <span
              className="truncate font-serif text-neutral-600"
              style={{ fontSize: Math.min(element.h * 0.13, 19) }}
            >
              {element.creator}
            </span>
            <span
              className="truncate text-neutral-400"
              style={{ fontSize: Math.min(element.h * 0.1, 14) }}
            >
              {facts.join(' \u00b7 ')}
            </span>
            {element.note && (
              <span
                className="mt-1 line-clamp-2 font-serif italic text-neutral-500"
                style={{ fontSize: Math.min(element.h * 0.11, 16) }}
              >
                {element.note}
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'embed': {
      const src = embedSrc(element)

      const video = element.provider === 'youtube'

      return (
        <div
          className={`flex h-full w-full flex-col overflow-hidden rounded-xl shadow-sm ${
            video ? 'bg-black' : 'bg-white'
          }`}
        >
          <iframe
            src={src}
            title={`${PROVIDER_LABEL[element.provider]} ${video ? 'video' : 'post'}`}
            loading="lazy"
            scrolling="no"
            referrerPolicy="strict-origin-when-cross-origin"
            // What a player needs to actually play, and nothing more:
            // autoplay is deliberately left out so a page never starts making
            // noise on its own.
            allow={video ? 'encrypted-media; picture-in-picture; fullscreen' : undefined}
            allowFullScreen={video}
            // Enough for each service's own script to run, but not enough for
            // it to navigate the page it's sitting on.
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="w-full flex-1 border-0"
            // In the editor the frame is a picture: letting it take the mouse
            // would make the element impossible to drag.
            style={{ pointerEvents: live ? 'auto' : 'none' }}
          />
          {element.note && (
            <p className="shrink-0 px-3 py-2 text-[13px] leading-snug text-neutral-600">
              {element.note}
            </p>
          )}
        </div>
      )
    }

    case 'tape':
      return (
        <div
          className="h-full w-full"
          style={{
            backgroundColor: element.color,
            opacity: 0.82,
            // Washi tape: faint diagonal weave plus torn-looking straight edges.
            backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.28) 0 8px, transparent 8px 16px)`,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
          }}
        />
      )
  }
}
