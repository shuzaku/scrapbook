import { NextResponse, type NextRequest } from 'next/server'
import { emailFromIdToken, exchangeCode } from '@/lib/google/oauth'
import { saveConnection } from '@/lib/google/tokens'

/** Where Google sends the person back after they approve (or don't). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const returnTo = request.cookies.get('google_oauth_return')?.value ?? '/settings/integrations'

  const done = (query: string) => {
    const response = NextResponse.redirect(new URL(`${returnTo}${query}`, request.url))
    response.cookies.delete('google_oauth_state')
    response.cookies.delete('google_oauth_return')
    return response
  }

  if (params.get('error')) {
    return done(`?google=denied`)
  }

  const state = params.get('state')
  const expected = request.cookies.get('google_oauth_state')?.value
  if (!state || !expected || state !== expected) {
    return done('?google=state_mismatch')
  }

  const code = params.get('code')
  if (!code) return done('?google=no_code')

  try {
    const tokens = await exchangeCode(code)
    await saveConnection({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      email: emailFromIdToken(tokens.idToken),
    })
    return done('?google=connected')
  } catch (err) {
    console.error('[google] token exchange failed', err)
    return done('?google=exchange_failed')
  }
}
