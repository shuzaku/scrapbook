import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Keeps the session fresh, and decides who may see the journal.
 *
 * Without Supabase credentials this does nothing at all: the journal is a
 * local, single-person thing and there is nobody to sign in as. With them,
 * every page of someone's journal needs a session — and the two exceptions are
 * deliberate: the auth pages themselves, and a shared scrapbook, which is
 * public by design and answers only to a token.
 */

/** Pages that hold someone's journal, and so need a session. */
const PRIVATE = ['/', '/book', '/entry', '/settings', '/dashboard']

/** Open by design: signing in, and a share link. */
const PUBLIC = ['/auth', '/s']

function isPrivate(pathname: string): boolean {
  if (PUBLIC.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false
  }
  // API routes answer with their own 401s rather than a redirect, which is
  // what a fetch can actually act on.
  if (pathname.startsWith('/api/')) return false

  return PRIVATE.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Local mode: no accounts, nothing to guard, nothing to refresh.
  if (!supabaseUrl || !supabaseUrl.startsWith('http') || !anonKey || anonKey.startsWith('your_')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser rather than getSession: this asks the auth server, so an expired
  // or forged cookie doesn't pass for a session.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { pathname, search } = request.nextUrl

  if (!user && isPrivate(pathname)) {
    const signIn = new URL('/auth/sign-in', request.url)
    // Come back to whatever they were trying to reach.
    signIn.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(signIn)
  }

  if (user && (pathname.startsWith('/auth/sign-in') || pathname.startsWith('/auth/sign-up'))) {
    const next = request.nextUrl.searchParams.get('next')
    // Only ever back into this app, never to wherever a query string says.
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    return NextResponse.redirect(new URL(safe, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
