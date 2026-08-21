/**
 * Book lookup through Open Library.
 *
 * No key, no account, no quota to run out of — which is why it's here rather
 * than Google Books, whose keyless path is a shared pool that answers 429 as
 * often as not. Goodreads is not an option at all: Amazon stopped issuing API
 * keys in December 2020 and took the developer portal down.
 */

const SEARCH = 'https://openlibrary.org/search.json'
const COVERS = 'https://covers.openlibrary.org'

/** Only what a sticker needs, so the response stays small and quick. */
const FIELDS = [
  'key',
  'title',
  'author_name',
  'first_publish_year',
  'cover_i',
  'number_of_pages_median',
].join(',')

export interface BookResult {
  /** Open Library work key, e.g. "/works/OL893414W". */
  key: string
  title: string
  author: string
  year: number | null
  pages: number | null
  /** Full-size cover, or null when Open Library has no picture for it. */
  coverUrl: string | null
  /** The book's page on Open Library. */
  url: string
}

export class BookSearchError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'BookSearchError'
  }
}

interface RawDoc {
  key?: unknown
  title?: unknown
  author_name?: unknown
  first_publish_year?: unknown
  cover_i?: unknown
  number_of_pages_median?: unknown
}

/** The cover image address for an Open Library cover id. */
export function coverUrl(id: number, size: 'S' | 'M' | 'L' = 'L'): string {
  return `${COVERS}/b/id/${id}-${size}.jpg`
}

/** Work keys are of the form /works/OL123W — checked before use in a link. */
export function isWorkKey(value: unknown): value is string {
  return typeof value === 'string' && /^\/works\/OL\d+[A-Z]$/.test(value)
}

export async function searchBooks(query: string, limit = 12): Promise<BookResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    fields: FIELDS,
  })

  let res: Response
  try {
    res = await fetch(`${SEARCH}?${params}`, {
      // Open Library asks callers to say who they are.
      headers: { 'User-Agent': 'Scrapbook journal (local, personal use)' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new BookSearchError('Could not reach Open Library', 502)
  }

  if (res.status === 429) {
    throw new BookSearchError('Open Library is rate limiting — try again in a moment', 429)
  }
  if (!res.ok) {
    throw new BookSearchError(`Open Library answered ${res.status}`, 502)
  }

  const body = (await res.json().catch(() => null)) as { docs?: unknown } | null
  const docs = Array.isArray(body?.docs) ? (body.docs as RawDoc[]) : []

  return docs.flatMap((doc) => {
    const title = typeof doc.title === 'string' ? doc.title.trim() : ''
    if (!title || !isWorkKey(doc.key)) return []

    // A work can list a dozen translators and editors; the first name is the
    // author people mean.
    const authors = Array.isArray(doc.author_name) ? doc.author_name : []
    const author = typeof authors[0] === 'string' ? authors[0] : ''

    const cover = typeof doc.cover_i === 'number' ? doc.cover_i : null

    return [
      {
        key: doc.key,
        title: title.slice(0, 200),
        author: author.slice(0, 200),
        year: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
        pages:
          typeof doc.number_of_pages_median === 'number' ? doc.number_of_pages_median : null,
        coverUrl: cover === null ? null : coverUrl(cover),
        url: `https://openlibrary.org${doc.key}`,
      },
    ]
  })
}
