'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 100%)' }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🔧</div>
          <h1 className="text-2xl font-bold text-white mb-3">Supabase not configured</h1>
          <p className="text-white/60 text-sm">Fill in your <code className="text-violet-300">.env.local</code> to get started.</p>
        </div>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    if (!supabase) { setError('Supabase not configured'); setLoading(false); return }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { preferred_username: username } },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create your scrapbook</h1>
          <p className="text-white/60">Start collecting your monthly memories</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-8">
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 text-red-300 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm text-white/80">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/80">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/80">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={8} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-white/50">
            Already have an account?{' '}
            <Link href="/auth/sign-in" className="text-violet-400 hover:text-violet-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
