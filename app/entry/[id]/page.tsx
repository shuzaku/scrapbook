import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Shell from '@/components/journal/Shell'
import CanvasView from '@/components/journal/canvas/CanvasView'
import ConfirmSubmit from '@/components/journal/ConfirmSubmit'
import { Button } from '@/components/ui/button'
import { deleteEntryAction } from '@/lib/journal/actions'
import { getEntry, getScrapbook, listEntries } from '@/lib/journal/store'

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = await getEntry(id)
  if (!entry) notFound()

  const hasPage = (entry.canvas?.elements.length ?? 0) > 0
  const book = await getScrapbook(entry.scrapbookId)

  // Reading order runs oldest to newest, matching the flip-through reader, so
  // "next" means the same thing in both places.
  const reading = (await listEntries(entry.scrapbookId)).slice().reverse()
  const position = reading.findIndex((sibling) => sibling.id === entry.id)
  const previous = position > 0 ? reading[position - 1] : null
  const next = position > -1 && position < reading.length - 1 ? reading[position + 1] : null

  return (
    <Shell
      crumb={book ? { href: `/book/${book.id}`, label: book.title } : undefined}
      action={
        <div className="flex gap-2">
          <Link href={`/book/${entry.scrapbookId}/read?at=${entry.id}`}>
            <Button size="sm" variant="outline">
              Flip from here
            </Button>
          </Link>
          <Link href={`/entry/${entry.id}/design`}>
            <Button size="sm">Design page</Button>
          </Link>
          <Link href={`/entry/${entry.id}/edit`}>
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </Link>
          <form action={deleteEntryAction}>
            <input type="hidden" name="id" value={entry.id} />
            <ConfirmSubmit
              label="Delete"
              question="Delete this entry?"
              detail={
                [
                  `"${entry.title}" will be gone for good`,
                  hasPage ? 'along with its laid-out page' : null,
                  entry.photos.length > 0
                    ? `and ${entry.photos.length} photo${entry.photos.length === 1 ? '' : 's'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' ') + '. This cannot be undone.'
              }
              confirmLabel="Delete entry"
              className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-white/70 transition-colors hover:bg-red-600 hover:text-white"
            />
          </form>
        </div>
      }
    >
      <article>
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-3 flex items-center gap-2 text-sm text-white/50">
            {entry.mood && <span className="text-xl">{entry.mood}</span>}
            <time dateTime={entry.date}>
              {format(new Date(`${entry.date}T12:00:00`), 'EEEE, d MMMM yyyy')}
            </time>
          </p>
          <h1 className="text-3xl font-bold text-white">{entry.title}</h1>
        </header>

        {hasPage ? (
          <CanvasView
            canvas={entry.canvas!}
            width={720}
            interactive
            className="mx-auto rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <Link
            href={`/entry/${entry.id}/design`}
            className="mb-8 flex items-center justify-between rounded-xl border border-dashed border-white/15 px-5 py-4 transition-colors hover:border-violet-400/60"
          >
            <span className="text-sm text-white/60">
              Lay this out as a scrapbook page — photos, stickers, tape, your own handwriting.
            </span>
            <span className="shrink-0 text-sm text-violet-300">Open the editor →</span>
          </Link>
        )}

        {entry.body && (
          <div className="mt-10 whitespace-pre-wrap text-[15px] leading-7 text-white/80">
            {entry.body}
          </div>
        )}

        {!hasPage && entry.photos.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {entry.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element -- local file served by /api/photos
              <img
                key={photo.name}
                src={`/api/photos/${photo.name}`}
                alt={photo.caption ?? ''}
                className="aspect-square w-full rounded-lg border border-white/10 object-cover"
              />
            ))}
          </div>
        )}

        <p className="mt-10 text-xs text-white/35">
          Last edited {format(new Date(entry.updatedAt), 'd MMM yyyy, HH:mm')}
        </p>
      </article>

      <nav className="mt-12 border-t border-white/10 pt-6">
        <p className="mb-4 text-center text-xs uppercase tracking-widest text-white/35">
          {position > -1 && `Page ${position + 1} of ${reading.length}`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {previous ? (
            <Link
              href={`/entry/${previous.id}`}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <span className="text-lg text-white/40 transition-colors group-hover:text-white">
                ‹
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-white/40">Previous page</span>
                <span className="block truncate text-sm text-white/80">{previous.title}</span>
              </span>
            </Link>
          ) : (
            <span className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-white/25">
              Start of the book
            </span>
          )}

          {next ? (
            <Link
              href={`/entry/${next.id}`}
              className="group flex items-center justify-end gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-right transition-colors hover:border-white/25 hover:bg-white/10"
            >
              <span className="min-w-0">
                <span className="block text-xs text-white/40">Next page</span>
                <span className="block truncate text-sm text-white/80">{next.title}</span>
              </span>
              <span className="text-lg text-white/40 transition-colors group-hover:text-white">
                ›
              </span>
            </Link>
          ) : (
            <span className="rounded-xl border border-dashed border-white/10 p-4 text-right text-xs text-white/25">
              End of the book
            </span>
          )}
        </div>
      </nav>
    </Shell>
  )
}
