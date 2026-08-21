import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isCloudBacked } from '@/lib/journal/store'
import { sanitizeCanvas } from '@/lib/journal/canvas'
import CanvasView from '@/components/journal/canvas/CanvasView'
import type { CanvasPage } from '@/lib/journal/types'

/**
 * A scrapbook someone chose to share.
 *
 * Open to anyone with the link and nothing else: the two functions behind it
 * answer only for a token, and only for a scrapbook still marked public. There
 * is no session here, so pictures come from the token-scoped route rather than
 * the one that needs an account.
 */

interface Props {
  params: Promise<{ token: string }>
}

interface SharedBook {
  id: string
  title: string
  subtitle: string
  cover_emoji: string
  created_at: string
}

interface SharedEntry {
  id: string
  date: string
  title: string
  body: string
  mood: string
  canvas: unknown
}

async function read(token: string): Promise<{ book: SharedBook; entries: SharedEntry[] } | null> {
  // Sharing is a hosted-only idea: a local journal has nobody to share with.
  if (!isCloudBacked()) return null

  const supabase = await createClient()
  const { data: books } = await supabase.rpc('shared_scrapbook', { p_token: token })
  const book = Array.isArray(books) ? (books[0] as SharedBook | undefined) : undefined
  if (!book) return null

  const { data: entries } = await supabase.rpc('shared_entries', { p_token: token })
  return { book, entries: Array.isArray(entries) ? (entries as SharedEntry[]) : [] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const shared = await read(token)
  if (!shared) return { title: 'Scrapbook' }

  return {
    title: shared.book.title,
    description: shared.book.subtitle || 'A shared scrapbook',
    // A shared page is deliberately unlisted rather than secret — a link is
    // enough to read it, so it should not also turn up in a search.
    robots: { index: false, follow: false },
  }
}

export default async function SharePage({ params }: Props) {
  const { token } = await params
  const shared = await read(token)
  if (!shared) notFound()

  const { book, entries } = shared
  const photoBase = `/api/s/${encodeURIComponent(token)}/photo`

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{book.cover_emoji || '📖'}</span>
            <div>
              <p className="font-bold text-white">{book.title}</p>
              {book.subtitle && <p className="text-sm text-white/50">{book.subtitle}</p>}
            </div>
          </div>
          <Link href="/" className="text-sm text-violet-400 hover:text-violet-300">
            Make your own →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-12 px-6 py-10">
        {entries.length === 0 && (
          <p className="text-sm text-white/40">Nothing in this scrapbook yet.</p>
        )}

        {entries.map((entry) => {
          // Never rendered as it came out of the database.
          const canvas: CanvasPage | null = entry.canvas ? sanitizeCanvas(entry.canvas) : null

          return (
            <article key={entry.id} className="space-y-4">
              <header>
                <p className="text-sm text-white/40">
                  {entry.mood && <span className="mr-2">{entry.mood}</span>}
                  {format(new Date(`${entry.date}T12:00:00`), 'EEEE, d MMMM yyyy')}
                </p>
                {entry.title && (
                  <h2 className="mt-1 text-2xl font-bold text-white">{entry.title}</h2>
                )}
              </header>

              {canvas && (
                <CanvasView
                  canvas={canvas}
                  width={720}
                  interactive
                  photoBase={photoBase}
                  className="rounded-xl"
                />
              )}

              {entry.body && (
                <p className="whitespace-pre-wrap leading-relaxed text-white/70">{entry.body}</p>
              )}
            </article>
          )
        })}
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-white/30">
        Shared with a link. Only what you see here is visible.
      </footer>
    </div>
  )
}
