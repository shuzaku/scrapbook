import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { format } from 'date-fns'
import Shell from '@/components/journal/Shell'
import EntryForm from '@/components/journal/EntryForm'
import { createEntryAction } from '@/lib/journal/actions'
import { getScrapbook } from '@/lib/journal/store'

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const book = await getScrapbook(id)
  if (!book) notFound()

  await connection()

  return (
    <Shell
      crumb={{ href: `/book/${book.id}`, label: book.title }}
      action={<span className="text-sm text-white/40">New entry</span>}
    >
      <h1 className="mb-8 text-2xl font-bold text-white">Add to {book.title}</h1>
      <EntryForm
        action={createEntryAction}
        scrapbookId={book.id}
        today={format(new Date(), 'yyyy-MM-dd')}
        submitLabel="Save entry"
        cancelHref={`/book/${book.id}`}
      />
    </Shell>
  )
}
