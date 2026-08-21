import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { authorizeUrl } from '@/lib/google/oauth'

/** Sends the person to Google's consent screen. */
export async function GET(request: NextRequest) {
  const state = randomUUID()
  const url = authorizeUrl(state)
  if (!url) {
    return NextResponse.redirect(new URL('/settings/integrations?error=unconfigured', request.url))
  }

  // Only ever come back to a path on this app — never an absolute URL a caller
  // supplied, which would make this an open redirect.
  const requested = request.nextUrl.searchParams.get('returnTo') ?? '/settings/integrations'
  const returnTo = requested.startsWith('/') && !requested.startsWith('//')
    ? requested
    : '/settings/integrations'

  const response = NextResponse.redirect(url)
  const secure = request.nextUrl.protocol === 'https:'
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 600,
  })
  response.cookies.set('google_oauth_return', returnTo, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 600,
  })
  return response
}
