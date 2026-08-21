'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { setEntryDateAction } from '@/lib/journal/actions'
import { takenOnDate } from '@/lib/photos/dates'
import type { Photo } from '@/lib/journal/types'

/**
 * Brings photos in from Google Photos.
 *
 * Google's picker refuses to be framed and ships no widget, so the choosing
 * itself happens in a popup window — opened with /autoclose so Google shuts it
 * again the moment you're done. This module owns everything either side of
 * that: it tracks the session, can re-open a blocked or closed window, offers
 * a QR code to pick on a phone instead, and shows what landed.
 */

interface Props {
  entryId: string
  /** The entry's current date, to compare against what was imported. */
  entryDate: string
  state: 'unconfigured' | 'disconnected' | 'connected'
  onImported: (photo: Photo) => void
}

/** The day most of these photos were taken, if they agree and it's a new one. */
function suggestedDate(photos: Photo[], entryDate: string): string | null {
  const days = photos.map((p) => p.takenAt).filter((t): t is string => !!t).map(takenOnDate)
  if (days.length === 0) return null

  const tally = new Map<string, number>()
  for (const day of days) tally.set(day, (tally.get(day) ?? 0) + 1)
  const [best] = [...tally.entries()].sort((a, b) => b[1] - a[1])
  return best[0] === entryDate ? null : best[0]
}

interface Session {
  sessionId: string
  sameDeviceUri: string
  qrSvg: string
  pollInterval: number
}

const POPUP_W = 520
const POPUP_H = 720

type Status =
  | { phase: 'idle' }
  | { phase: 'opening' }
  | { phase: 'waiting'; session: Session }
  | { phase: 'importing' }
  | { phase: 'done'; imported: Photo[]; failures: { name: string; reason: string }[] }
  | { phase: 'error'; message: string; helpUrl?: string }

export default function GooglePhotosImport({
  entryId,
  entryDate,
  state,
  onImported,
}: Props) {
  const [status, setStatus] = useState<Status>({ phase: 'idle' })
  const [dateSet, setDateSet] = useState<string | null>(null)
  const cancelled = useRef(false)
  const popup = useRef<Window | null>(null)

  useEffect(() => () => { cancelled.current = true }, [])

  /**
   * Opens the picker window. Called straight from the click so the browser
   * still counts it as user-initiated; the session URL is filled in after.
   */
  const openPopup = useCallback((url?: string) => {
    const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_W) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_H) / 2)
    // No `noopener`: the handle lets us close the window once picks arrive.
    const win = window.open(
      url ?? '',
      'google-photos-picker',
      `popup=yes,width=${POPUP_W},height=${POPUP_H},left=${Math.round(left)},top=${Math.round(top)}`
    )
    if (win) popup.current = win
    return win
  }, [])

  const closePopup = useCallback(() => {
    try {
      popup.current?.close()
    } catch {
      // Cross-origin windows may refuse to close; harmless.
    }
    popup.current = null
  }, [])

  const readError = useCallback(async (res: Response) => {
    const body = (await res.json().catch(() => ({}))) as { error?: string; helpUrl?: string }
    setStatus({
      phase: 'error',
      message: body.error ?? `Request failed (${res.status})`,
      helpUrl: body.helpUrl,
    })
  }, [])

  async function start() {
    cancelled.current = false
    setDateSet(null)
    setStatus({ phase: 'opening' })

    // Claim the window now, while this is still a user gesture.
    const win = openPopup()

    try {
      const opened = await fetch('/api/integrations/google/session', { method: 'POST' })
      if (!opened.ok) {
        win?.close()
        return readError(opened)
      }

      const session = (await opened.json()) as Session
      if (win) win.location.href = session.sameDeviceUri
      setStatus({ phase: 'waiting', session })

      // Picking on a phone takes as long as it takes.
      const deadline = Date.now() + 15 * 60_000
      let wait = session.pollInterval
      let closedPolls = 0

      while (!cancelled.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, wait))
        if (cancelled.current) return

        const res = await fetch('/api/integrations/google/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId, entryId }),
        })
        if (!res.ok) {
          closePopup()
          return readError(res)
        }

        const data = (await res.json()) as {
          ready: boolean
          photos?: Photo[]
          failures?: { name: string; reason: string }[]
          pollInterval?: number
        }

        if (data.ready) {
          setStatus({ phase: 'importing' })
          closePopup()
          const photos = data.photos ?? []
          for (const photo of photos) onImported(photo)
          setStatus({ phase: 'done', imported: photos, failures: data.failures ?? [] })
          return
        }

        // Google's /autoclose shuts the window on success, so allow a couple of
        // polls after it disappears before deciding they walked away.
        if (popup.current?.closed) closedPolls += 1
        if (closedPolls >= 3) {
          setStatus({
            phase: 'error',
            message: 'The picker window closed before anything was chosen.',
          })
          return
        }

        wait = data.pollInterval ?? wait
      }

      if (!cancelled.current) {
        closePopup()
        setStatus({ phase: 'error', message: 'Timed out waiting for your picks.' })
      }
    } catch (err) {
      closePopup()
      setStatus({ phase: 'error', message: err instanceof Error ? err.message : 'Import failed' })
    }
  }

  function dismiss() {
    cancelled.current = true
    closePopup()
    setStatus({ phase: 'idle' })
  }

  if (state === 'unconfigured') {
    return (
      <a
        href="/settings/integrations"
        className="block text-xs text-white/40 underline underline-offset-2 hover:text-white/70"
      >
        Set up Google Photos importing
      </a>
    )
  }

  if (state === 'disconnected') {
    return (
      <a
        href={`/api/integrations/google/start?returnTo=/entry/${entryId}/design`}
        className="block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-center text-sm text-white/80 transition-colors hover:bg-white/10"
      >
        Connect Google Photos
      </a>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={status.phase !== 'idle'}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        🖼 Import from Google Photos
      </button>

      {status.phase !== 'idle' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#15121f] p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <span>🖼</span> Import from Google Photos
              </h2>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close"
                className="rounded-md px-2 py-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            {status.phase === 'opening' && (
              <p className="mt-6 text-sm text-white/60">Opening a picking session…</p>
            )}

            {status.phase === 'waiting' && (
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed text-white/75">
                    Choose your photos in the Google Photos window — it closes itself when you’re
                    done, and they’ll land here automatically.
                  </p>
                  <p className="flex items-center gap-2 text-xs text-violet-200">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
                    Waiting for your picks…
                  </p>
                  <button
                    type="button"
                    onClick={() => openPopup(status.session.sameDeviceUri)}
                    className="text-xs text-violet-300 underline underline-offset-2 hover:text-violet-200"
                  >
                    Window didn’t open, or you closed it? Open it again
                  </button>
                </div>

                <div className="flex gap-5 border-t border-white/10 pt-5">
                  <div
                    className="shrink-0 overflow-hidden rounded-lg bg-white p-1.5"
                    style={{ width: 108, height: 108 }}
                    // Generated by our own server from the session URI.
                    dangerouslySetInnerHTML={{ __html: status.session.qrSvg }}
                  />
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-medium text-white/70">Or pick on your phone</p>
                    <p className="text-xs leading-relaxed text-white/40">
                      Scan this and choose there instead — the photos still arrive in this window.
                      Handy when the shots you want never made it to this machine.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status.phase === 'importing' && (
              <p className="mt-6 text-sm text-white/70">Bringing your photos across…</p>
            )}

            {status.phase === 'done' && (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-green-300">
                  {status.imported.length === 0
                    ? 'Nothing was imported.'
                    : `Added ${status.imported.length} photo${
                        status.imported.length === 1 ? '' : 's'
                      } — drag them onto the page from the Photos tab.`}
                </p>

                {status.imported.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {status.imported.slice(0, 8).map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
                      <img
                        key={photo.name}
                        src={`/api/photos/${photo.name}`}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                )}

                {(() => {
                  const suggestion = suggestedDate(status.imported, entryDate)
                  if (!suggestion) return null
                  const label = format(new Date(`${suggestion}T12:00:00`), 'd MMMM yyyy')

                  return dateSet ? (
                    <p className="text-xs text-white/50">
                      Entry dated {format(new Date(`${dateSet}T12:00:00`), 'd MMMM yyyy')}.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/60">
                        {status.imported.length === 1 ? 'This was' : 'These were'} taken on{' '}
                        <span className="text-white/85">{label}</span>, but the entry is dated{' '}
                        {format(new Date(`${entryDate}T12:00:00`), 'd MMM yyyy')}.
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await setEntryDateAction(entryId, suggestion)
                          setDateSet(suggestion)
                        }}
                        className="shrink-0 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
                      >
                        Use that date
                      </button>
                    </div>
                  )
                })()}

                {status.failures.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-200">
                      {status.failures.length} couldn’t be imported:
                    </p>
                    <ul className="mt-1.5 space-y-1 text-xs text-amber-100/80">
                      {status.failures.slice(0, 5).map((failure) => (
                        <li key={failure.name}>
                          {failure.name} — {failure.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {status.phase === 'error' && (
              <div className="mt-6 space-y-2">
                <p className="text-sm leading-relaxed text-red-300">{status.message}</p>
                {status.helpUrl && (
                  <a
                    href={status.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-red-200 underline underline-offset-2"
                  >
                    Open the fix in Google Cloud →
                  </a>
                )}
              </div>
            )}

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {status.phase === 'done' || status.phase === 'error' ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
