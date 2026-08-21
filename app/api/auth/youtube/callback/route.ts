import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { exchangeCode, encryptTokens } from '@/lib/providers/youtube'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=youtube_denied', request.url))
  }

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_state', request.url))
  }

  try {
    const tokens = await exchangeCode(code)
    const { encAccess, encRefresh } = await encryptTokens(tokens.access_token, tokens.refresh_token)

    const supabase = await createServiceClient()
    await supabase.from('connected_accounts').upsert({
      user_id: userId,
      provider: 'youtube',
      access_token: encAccess,
      refresh_token: encRefresh,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope.split(' '),
      needs_reauth: false,
    }, { onConflict: 'user_id,provider' })

    return NextResponse.redirect(new URL('/dashboard?connected=youtube', request.url))
  } catch (err) {
    console.error('YouTube OAuth error:', err)
    return NextResponse.redirect(new URL('/dashboard?error=youtube_failed', request.url))
  }
}
