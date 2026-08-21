import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { previousMonthKey } from '@/lib/month-key'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const monthKey = request.nextUrl.searchParams.get('month') ?? previousMonthKey()

  const { data, error } = await supabase
    .from('stickers')
    .select('*, events!inner(month_key, provider, event_type, display_title)')
    .eq('user_id', user.id)
    .eq('events.month_key', monthKey)
    .eq('generation_status', 'done')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
