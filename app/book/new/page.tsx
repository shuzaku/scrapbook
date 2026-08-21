import Shell from '@/components/journal/Shell'
import BookForm from '@/components/journal/BookForm'
import { createScrapbookAction } from '@/lib/journal/actions'

export default function NewBookPage() {
  return (
    <Shell
      crumb={{ href: '/', label: 'Shelf' }}
      action={<span className="text-sm text-white/40">New scrapbook</span>}
    >
      <h1 className="mb-8 text-2xl font-bold text-white">Start a scrapbook</h1>
      <BookForm action={createScrapbookAction} submitLabel="Create scrapbook" cancelHref="/" />
    </Shell>
  )
}
