import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSyncQueue, type SyncJobData } from '@/lib/queue'
import { previousMonthKey } from '@/lib/month-key'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const monthKey: string = body.monthKey ?? previousMonthKey()

  const { data: accounts } = await supabase
    .from('connected_accounts')
    .select('provider')
    .eq('user_id', user.id)
    .eq('needs_reauth', false)

  if (!accounts?.length) return NextResponse.json({ enqueued: 0 })

  const queue = getSyncQueue()
  await Promise.all(accounts.map((a) => {
    const job: SyncJobData = { userId: user.id, provider: a.provider, monthKey }
    return queue.add('sync', job, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
  }))

  return NextResponse.json({ enqueued: accounts.length, monthKey })
}
