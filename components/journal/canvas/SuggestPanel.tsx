'use client'

import { useState } from 'react'
import type { Suggestion, SuggestionKind } from '@/lib/ai/suggest'

/**
 * Asks Claude what else might go on this page.
 *
 * Every other tab fetches something; this one reads what's already there and
 * points at the tabs. Each suggestion opens the tab that can act on it, with
 * the search already filled in.
 */

const ICON: Record<SuggestionKind, string> = {
  place: '📍',
  weather: '🌦',
  song: '♪',
  shelf: '📚',
  photo: '🖼',
  write: '✍️',
}

/** Which tab each kind sends you to; `write` is for the person, not the app. */
const TAB: Record<SuggestionKind, string | null> = {
  place: 'places',
  weather: 'places',
  song: 'music',
  shelf: 'shelf',
  photo: 'photos',
  write: null,
}

interface Props {
  entryId: string
  configured: boolean
  onJump: (tab: string, query: string, medium?: string) => void
}

export default function SuggestPanel({ entryId, configured, onJump }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    setThinking(true)
    setError(null)
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not think of anything')
      setSuggestions(data.suggestions as Suggestion[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not think of anything')
    } finally {
      setThinking(false)
    }
  }

  if (!configured) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-white/50">
          Claude can read an entry and suggest what else might go on the page — the weather that
          day, the restaurant you mentioned, the film you described but never named.
        </p>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
          This is the only part of the journal that sends anything anywhere. Set{' '}
          <span className="font-mono text-amber-50">ANTHROPIC_API_KEY</span> in{' '}
          <span className="font-mono text-amber-50">.env.local</span> to switch it on.
        </p>
        <a
          href="/settings/integrations"
          className="block text-xs text-white/40 underline underline-offset-2 hover:text-white/70"
        >
          How to set it up
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={ask}
        disabled={thinking}
        className="w-full rounded-lg border border-violet-400/40 bg-violet-500/20 px-3 py-2.5 text-sm text-white transition-colors hover:bg-violet-500/30 disabled:opacity-50"
      >
        {thinking ? 'Reading the page…' : suggestions ? 'Have another look' : 'What else could go here?'}
      </button>

      {error && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          {error}
        </p>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-xs leading-relaxed text-white/40">
          Nothing to add — the page looks finished.
        </p>
      )}

      <div className="space-y-1.5">
        {(suggestions ?? []).map((suggestion, at) => {
          const tab = TAB[suggestion.kind]

          return (
            <div
              key={`${suggestion.kind}-${at}`}
              className="rounded-lg border border-white/10 bg-white/5 p-2.5"
            >
              <p className="flex items-start gap-2 text-sm text-white/85">
                <span className="shrink-0">{ICON[suggestion.kind]}</span>
                <span>{suggestion.label}</span>
              </p>
              <p className="mt-1 pl-6 text-xs leading-relaxed text-white/45">{suggestion.why}</p>

              {tab && (
                <button
                  type="button"
                  onClick={() =>
                    onJump(
                      tab,
                      suggestion.query,
                      suggestion.medium === 'none' ? undefined : suggestion.medium
                    )
                  }
                  className="mt-2 ml-6 rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {suggestion.query ? `Look up “${suggestion.query}”` : 'Open that tab'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {suggestions && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Suggestions come from reading this entry. They can be wrong — nothing is added until you
          add it.
        </p>
      )}

      {!suggestions && !thinking && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Pressing this sends what you&rsquo;ve written on this page to Anthropic to be read.
          Nothing else in the journal leaves your machine.
        </p>
      )}
    </div>
  )
}
