'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ConnectedAccount, ProviderType } from '@/lib/supabase/types'

const PROVIDERS: { id: ProviderType; label: string; color: string; icon: string; href: string }[] = [
  { id: 'spotify', label: 'Spotify', color: '#1DB954', icon: '🎵', href: '/api/auth/spotify/start' },
  { id: 'steam', label: 'Steam', color: '#4a9eff', icon: '🎮', href: '/api/auth/steam/start' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000', icon: '▶️', href: '/api/auth/youtube/start' },
]

export default function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.from('connected_accounts').select().then(({ data }) => {
      setAccounts(data ?? [])
      setLoading(false)
    })
  }, [])

  async function disconnect(provider: ProviderType) {
    if (!supabase) return
    await supabase.from('connected_accounts').delete().eq('provider', provider)
    setAccounts((prev) => prev.filter((a) => a.provider !== provider))
  }

  if (loading) return <div className="text-white/40 text-sm">Loading accounts…</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Services</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PROVIDERS.map((p) => {
          const account = accounts.find((a) => a.provider === p.id)
          return (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{p.icon}</span>
                <div>
                  <div className="text-sm font-medium text-white">{p.label}</div>
                  {account ? (
                    <div className="text-xs text-white/50">
                      {account.needs_reauth ? '⚠️ Needs reconnection' : '✓ Connected'}
                      {account.last_synced_at && ` · Last synced ${new Date(account.last_synced_at).toLocaleDateString()}`}
                    </div>
                  ) : (
                    <div className="text-xs text-white/40">Not connected</div>
                  )}
                </div>
              </div>
              {account ? (
                <Button variant="outline" size="sm" onClick={() => disconnect(p.id)}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  style={{ backgroundColor: p.color, color: '#000' }}
                  onClick={() => window.location.href = p.href}
                >
                  Connect
                </Button>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
