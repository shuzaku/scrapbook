import { notFound } from 'next/navigation'
import PageFlipper from '@/components/journal/PageFlipper'
import { getScrapbook, listEntries } from '@/lib/journal/store'

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ at?: string }>
}) {
  const { id } = await params
  const book = await getScrapbook(id)
  if (!book) notFound()

  // Oldest first: a book reads front to back.
  const entries = (await listEntries(id)).slice().reverse()

  // `?at=<entryId>` opens the book at that entry instead of the cover.
  // Sheet 0 is the cover, so an entry's sheet is its index plus one.
  const { at } = await searchParams
  const found = at ? entries.findIndex((entry) => entry.id === at) : -1

  return (
    <PageFlipper book={book} entries={entries} startIndex={found === -1 ? 0 : found + 1} />
  )
}
