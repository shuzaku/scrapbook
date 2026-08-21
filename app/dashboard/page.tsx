import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { previousMonthKey, monthKeyToLabel } from '@/lib/month-key'
import ConnectedAccounts from '@/components/dashboard/ConnectedAccounts'
import StickerGallery from '@/components/dashboard/StickerGallery'
import { Button } from '@/components/ui/button'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; month?: string }>
}) {
  // Accounts are a later, key-dependent feature — the local journal is the app for now.
  if (!isSupabaseConfigured()) redirect('/')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/sign-in')

  const params = await searchParams
  const monthKey = params.month ?? previousMonthKey()

  const { data: scrapbooks } = await supabase
    .from('scrapbooks')
    .select('id, month_key, title, thumbnail_url, updated_at')
    .eq('user_id', user.id)
    .eq('month_key', monthKey)
    .order('updated_at', { ascending: false })
    .limit(1)

  const currentScrapbook = scrapbooks?.[0]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 100%)' }}>
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📖</span>
          <span className="font-bold text-white text-lg">Scrapbook</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60">{user.email}</span>
          <form action="/api/auth/sign-out" method="POST">
            <Button variant="ghost" size="sm" type="submit">Sign out</Button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Notifications */}
        {params.connected && (
          <div className="bg-green-500/20 border border-green-500/40 text-green-300 rounded-lg px-4 py-3 text-sm">
            ✓ {params.connected.charAt(0).toUpperCase() + params.connected.slice(1)} connected successfully!
          </div>
        )}
        {params.error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm">
            ⚠ Connection failed: {params.error.replace(/_/g, ' ')}
          </div>
        )}

        {/* Month header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{monthKeyToLabel(monthKey)}</h1>
            <p className="text-white/50 mt-1">Your monthly scrapbook</p>
          </div>
          <div className="flex gap-2">
            {currentScrapbook ? (
              <Link href={`/dashboard/editor/${currentScrapbook.id}`}>
                <Button>Open Editor →</Button>
              </Link>
            ) : (
              <form action="/api/scrapbooks" method="POST">
                <input type="hidden" name="monthKey" value={monthKey} />
                <Button type="submit">+ Create Scrapbook</Button>
              </form>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StickerGallery monthKey={monthKey} />
          </div>
          <div>
            <ConnectedAccounts />
          </div>
        </div>
      </main>
    </div>
  )
}
