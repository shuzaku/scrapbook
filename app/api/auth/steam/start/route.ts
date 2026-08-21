import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/providers/steam'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const returnTo = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/steam/callback?userId=${user.id}`
  return NextResponse.redirect(getAuthUrl(returnTo))
}
