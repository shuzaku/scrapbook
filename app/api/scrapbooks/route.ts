import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { previousMonthKey } from '@/lib/month-key'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const monthKey = request.nextUrl.searchParams.get('month') ?? previousMonthKey()

  const { data, error } = await supabase
    .from('scrapbooks')
    .select()
    .eq('user_id', user.id)
    .eq('month_key', monthKey)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const monthKey: string = body.monthKey ?? previousMonthKey()

  const { data, error } = await supabase
    .from('scrapbooks')
    .insert({ user_id: user.id, month_key: monthKey, title: body.title ?? `${monthKey} Scrapbook` })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
