import Link from 'next/link'
import { connection } from 'next/server'
import { formatDistanceToNow } from 'date-fns'
import Shell from '@/components/journal/Shell'
import BookCover from '@/components/journal/BookCover'
import { Button } from '@/components/ui/button'
import ConfirmSubmit from '@/components/journal/ConfirmSubmit'
import { deleteScrapbookAction } from '@/lib/journal/actions'
import { countEntries, listScrapbooks } from '@/lib/journal/store'

export default async function ShelfPage() {
  await connection()
  const [books, counts] = await Promise.all([listScrapbooks(), countEntries()])

  return (
    <Shell
      action={
        <div className="flex items-center gap-3">
          <Link
            href="/settings/integrations"
            className="text-sm text-white/50 transition-colors hover:text-white"
          >
            Integrations
          </Link>
          <Link href="/book/new">
            <Button size="sm">New scrapbook</Button>
          </Link>
        </div>
      }
    >
      <div className="mb-10">
        <p className="mb-2 text-xs uppercase tracking-widest text-violet-400">Your shelf</p>
        <h1 className="text-3xl font-bold text-white">
          {books.length === 0
            ? 'No scrapbooks yet'
            : `${books.length} ${books.length === 1 ? 'scrapbook' : 'scrapbooks'}`}
        </h1>
      </div>

      {books.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-12 text-center">
          <div className="mb-4 text-4xl">📖</div>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-white/55">
            A scrapbook holds entries — one per day, each with its own laid-out page. Keep a book
            per trip, per year, per anything.
          </p>
          <Link href="/book/new">
            <Button>Start a scrapbook</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const count = counts[book.id] ?? 0
            return (
              <div key={book.id} className="group relative">
                <Link href={`/book/${book.id}`} className="group block">
                  <BookCover book={book} />
                  <div className="mt-3">
                    <h2 className="truncate font-semibold text-white transition-colors group-hover:text-violet-300">
                      {book.title}
                    </h2>
                    {book.subtitle && (
                      <p className="mt-0.5 truncate text-sm text-white/50">{book.subtitle}</p>
                    )}
                    <p className="mt-1 text-xs text-white/35">
                      {count === 0 ? 'Empty' : `${count} ${count === 1 ? 'entry' : 'entries'}`} ·
                      updated {formatDistanceToNow(new Date(book.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                </Link>

                <form action={deleteScrapbookAction} className="absolute right-2 top-2">
                  <input type="hidden" name="id" value={book.id} />
                  <ConfirmSubmit
                    label="Delete"
                    question={`Delete "${book.title}"?`}
                    detail={
                      count === 0
                        ? 'This scrapbook is empty, so nothing else goes with it. This cannot be undone.'
                        : `Its ${count} ${
                            count === 1 ? 'entry' : 'entries'
                          }, their pages and their photos go too. This cannot be undone.`
                    }
                    confirmLabel="Delete scrapbook"
                    title={`Delete "${book.title}"`}
                    className="rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white/70 backdrop-blur transition-colors hover:border-red-400/60 hover:bg-red-600 hover:text-white"
                  />
                </form>
              </div>
            )
          })}

          <Link
            href="/book/new"
            className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-white/45 transition-colors hover:border-violet-400/60 hover:text-white"
          >
            ＋ New scrapbook
          </Link>
        </div>
      )}
    </Shell>
  )
}
