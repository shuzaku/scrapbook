import { notFound } from 'next/navigation'
import Shell from '@/components/journal/Shell'
import BookForm from '@/components/journal/BookForm'
import ConfirmSubmit from '@/components/journal/ConfirmSubmit'
import { Button } from '@/components/ui/button'
import { deleteScrapbookAction, updateScrapbookAction } from '@/lib/journal/actions'
import { getScrapbook, listEntries } from '@/lib/journal/store'

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getScrapbook(id)
  if (!book) notFound()

  const entries = await listEntries(id)

  return (
    <Shell
      crumb={{ href: `/book/${book.id}`, label: book.title }}
      action={<span className="text-sm text-white/40">Book settings</span>}
    >
      <h1 className="mb-8 text-2xl font-bold text-white">Book settings</h1>

      <BookForm
        action={updateScrapbookAction}
        book={book}
        submitLabel="Save changes"
        cancelHref={`/book/${book.id}`}
      />

      {entries.length > 0 && (
        <p className="mt-4 max-w-lg text-xs leading-relaxed text-white/40">
          Changing the page size applies to pages you make from now on — the{' '}
          {entries.length === 1 ? 'page that exists' : `${entries.length} pages that exist`} keep
          the size they were laid out at.
        </p>
      )}

      <section className="mt-12 rounded-xl border border-red-500/25 bg-red-500/5 p-5">
        <h2 className="font-medium text-white">Delete this scrapbook</h2>
        <p className="mt-1 max-w-lg text-sm leading-relaxed text-white/55">
          {entries.length === 0
            ? 'This book is empty, so nothing else goes with it.'
            : `This also deletes ${entries.length} ${
                entries.length === 1 ? 'entry' : 'entries'
              } inside it, their pages and their photos. It cannot be undone.`}
        </p>
        <form action={deleteScrapbookAction} className="mt-4">
          <input type="hidden" name="id" value={book.id} />
          <ConfirmSubmit
            label="Delete scrapbook"
            question={`Delete "${book.title}"?`}
            detail={
              entries.length === 0
                ? 'This scrapbook is empty, so nothing else goes with it. This cannot be undone.'
                : `Its ${entries.length} ${
                    entries.length === 1 ? 'entry' : 'entries'
                  }, their pages and their photos go too. This cannot be undone.`
            }
            confirmLabel="Delete scrapbook"
            className="inline-flex h-9 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
          />
        </form>
      </section>
    </Shell>
  )
}
