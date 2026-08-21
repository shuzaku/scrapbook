import { NextResponse } from 'next/server'
import { searchBooks } from '@/lib/books/openlibrary'
import { searchAniList } from '@/lib/media/anilist'
import { searchFilms } from '@/lib/media/cinemeta'
import { MediaSearchError, isMedium, type MediaResult } from '@/lib/media/types'

/**
 * Looks up a book, film, anime or manga.
 *
 * Four services behind one address, none of which needs a key: Open Library,
 * Cinemeta and AniList. Whatever answers comes back in the same shape.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim().slice(0, 200) ?? ''
  const medium = params.get('medium') ?? 'book'

  if (!query) return NextResponse.json({ error: 'Type something to look for' }, { status: 400 })
  if (!isMedium(medium)) {
    return NextResponse.json({ error: 'Unknown kind of thing to search for' }, { status: 400 })
  }

  try {
    let results: MediaResult[]
    switch (medium) {
      case 'book':
        results = (await searchBooks(query)).map((book) => ({
          key: book.key,
          medium: 'book' as const,
          title: book.title,
          creator: book.author,
          year: book.year,
          detail: book.pages ? `${book.pages} pages` : '',
          // Open Library has ratings, but not in the search response.
          rating: '',
          url: book.url,
          coverUrl: book.coverUrl,
        }))
        break
      case 'film':
        results = await searchFilms(query)
        break
      default:
        results = await searchAniList(query, medium)
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error(`[media] ${medium} search failed`, err)
    // Open Library keeps its own error class so it stays dependency-free;
    // what matters here is whether the failure carried a status worth passing
    // on, such as a rate limit.
    const status =
      err instanceof MediaSearchError || (err instanceof Error && 'status' in err)
        ? Number((err as { status?: unknown }).status) || 502
        : 502
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status }
    )
  }
}
