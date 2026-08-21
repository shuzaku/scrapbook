import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { extractSteamId, getPlayerSummary } from '@/lib/providers/steam'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = searchParams.get('userId')

  if (!userId) return NextResponse.redirect(new URL('/dashboard?error=invalid_state', request.url))

  const steamId = extractSteamId(searchParams)
  if (!steamId) return NextResponse.redirect(new URL('/dashboard?error=steam_no_id', request.url))

  try {
    const profile = await getPlayerSummary(steamId)
    const supabase = await createServiceClient()

    await supabase.from('connected_accounts').upsert({
      user_id: userId,
      provider: 'steam',
      provider_user_id: steamId,
      needs_reauth: false,
      extra_data: { steam_id: steamId, display_name: profile?.personaname, avatar: profile?.avatarfull },
    }, { onConflict: 'user_id,provider' })

    return NextResponse.redirect(new URL('/dashboard?connected=steam', request.url))
  } catch (err) {
    console.error('Steam callback error:', err)
    return NextResponse.redirect(new URL('/dashboard?error=steam_failed', request.url))
  }
}
