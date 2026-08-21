import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Shell from '@/components/journal/Shell'
import CanvasView from '@/components/journal/canvas/CanvasView'
import { Button } from '@/components/ui/button'
import ConfirmSubmit from '@/components/journal/ConfirmSubmit'
import { deleteEntryAction } from '@/lib/journal/actions'
import { getScrapbook, isCloudBacked, listEntries } from '@/lib/journal/store'
import { shareState } from '@/lib/journal/store-cloud'
import ShareCard from '@/components/journal/ShareCard'
import { headers } from 'next/headers'
import { monthKeyToLabel, toMonthKey } from '@/lib/month-key'
import type { Entry } from '@/lib/journal/types'

function groupByMonth(entries: Entry[]): [string, Entry[]][] {
  const months = new Map<string, Entry[]>()
  for (const entry of entries) {
    const key = toMonthKey(new Date(`${entry.date}T12:00:00`))
    const bucket = months.get(key)
    if (bucket) bucket.push(entry)
    else months.set(key, [entry])
  }
  return [...months.entries()]
}

function Thumbnail({ entry }: { entry: Entry }) {
  // A designed page previews as a real miniature of itself.
  if (entry.canvas && entry.canvas.elements.length > 0) {
    return (
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10">
        <CanvasView canvas={entry.canvas} width={80} />
      </div>
    )
  }

  const cover = entry.photos[0]
  if (cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
      <img
        src={`/api/photos/${cover.name}`}
        alt=""
        className="h-20 w-20 shrink-0 rounded-lg object-cover"
      />
    )
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-white/5 text-2xl">
      {entry.mood || '📝'}
    </div>
  )
}

function EntryCard({ entry }: { entry: Entry }) {
  return (
    // The delete control sits beside the link rather than inside it — a form
    // nested in an anchor is invalid, and would swallow the click besides.
    <div className="group relative">
      <Link
        href={`/entry/${entry.id}`}
        className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/25 hover:bg-white/10"
      >
        <Thumbnail entry={entry} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate font-semibold text-white">{entry.title}</h3>
            <span className="shrink-0 text-xs text-white/40">
              {format(new Date(`${entry.date}T12:00:00`), 'EEE d')}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/55">
            {entry.body || 'No notes yet.'}
          </p>
          <div className="mt-2 flex items-center gap-3 pr-16 text-xs text-white/40">
            {entry.mood && <span className="text-sm">{entry.mood}</span>}
            {entry.canvas && entry.canvas.elements.length > 0 && <span>designed page</span>}
          {entry.photos.length > 0 && (
            <span>
              {entry.photos.length} photo{entry.photos.length === 1 ? '' : 's'}
            </span>
          )}
          </div>
        </div>
      </Link>

      <form action={deleteEntryAction} className="absolute bottom-3 right-3">
        <input type="hidden" name="id" value={entry.id} />
        <ConfirmSubmit
          label="Delete"
          question="Delete this entry?"
          detail={`"${entry.title}" and everything on its page will be gone for good. This cannot be undone.`}
          confirmLabel="Delete entry"
          title={`Delete "${entry.title}"`}
          className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/50 transition-colors hover:border-red-400/60 hover:bg-red-600 hover:text-white group-hover:text-white/75"
        />
      </form>
    </div>
  )
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getScrapbook(id)
  if (!book) notFound()

  const entries = await listEntries(id)
  const months = groupByMonth(entries)

  // Sharing only exists in the hosted version; locally there is nobody to
  // share with, so the card is simply absent.
  const share = isCloudBacked() ? await shareState(id) : null
  const host = (await headers()).get('host') ?? 'localhost:3000'
  const origin = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`

  return (
    <Shell
      crumb={{ href: '/', label: 'Shelf' }}
      action={
        <div className="flex gap-2">
          <Link href={`/book/${book.id}/edit`}>
            <Button size="sm" variant="ghost">
              Book settings
            </Button>
          </Link>
          <Link href={`/book/${book.id}/read`}>
            <Button size="sm" variant="outline">
              Flip through
            </Button>
          </Link>
          <Link href={`/book/${book.id}/new`}>
            <Button size="sm">New entry</Button>
          </Link>
        </div>
      }
    >
      <div className="mb-10 flex items-start gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: book.cover.color }}
        >
          {book.cover.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-white">{book.title}</h1>
          <p className="mt-1 text-sm text-white/50">
            {book.subtitle ||
              `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} in this book`}
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-12 text-center">
          <div className="mb-4 text-4xl">{book.cover.emoji}</div>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-white/55">
            Nothing in this book yet. Write about a day, then lay it out as a page.
          </p>
          <Link href={`/book/${book.id}/new`}>
            <Button>Write the first entry</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {months.map(([monthKey, monthEntries]) => (
            <section key={monthKey}>
              <h2 className="mb-4 flex items-center gap-3 text-sm font-medium text-white/70">
                {monthKeyToLabel(monthKey)}
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/35">{monthEntries.length}</span>
              </h2>
              <div className="space-y-3">
                {monthEntries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {share && (
        <ShareCard id={book.id} state={share} origin={origin} />
      )}
    </Shell>
  )
}
