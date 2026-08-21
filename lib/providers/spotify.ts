import { encrypt, decrypt } from '@/lib/crypto'
import { toMonthKey, monthKeyToRange } from '@/lib/month-key'
import type { Event } from '@/lib/supabase/types'

const BASE = 'https://api.spotify.com/v1'
const AUTH_BASE = 'https://accounts.spotify.com'
const SCOPES = ['user-read-recently-played', 'user-top-read', 'user-read-private'].join(' ')

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    state,
  })
  return `${AUTH_BASE}/authorize?${params}`
}

export async function exchangeCode(code: string) {
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.SPOTIFY_REDIRECT_URI! }),
  })
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; scope: string }>
}

export async function refreshAccessToken(encryptedRefreshToken: string) {
  const refreshToken = await decrypt(encryptedRefreshToken)
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; expires_in: number; refresh_token?: string }>
}

export async function encryptTokens(accessToken: string, refreshToken: string) {
  const [encAccess, encRefresh] = await Promise.all([encrypt(accessToken), encrypt(refreshToken)])
  return { encAccess, encRefresh }
}

async function apiGet(path: string, accessToken: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Spotify API error ${res.status} at ${path}`)
  return res.json()
}

export async function getProfile(accessToken: string) {
  return apiGet('/me', accessToken)
}

export async function fetchMonthEvents(accessToken: string, monthKey: string): Promise<Omit<Event, 'id' | 'created_at' | 'user_id'>[]> {
  const { start, end } = monthKeyToRange(monthKey)
  const events: Omit<Event, 'id' | 'created_at' | 'user_id'>[] = []

  // Top tracks for the month (short_term = ~4 weeks)
  try {
    const topTracks = await apiGet('/me/top/tracks?limit=10&time_range=short_term', accessToken)
    topTracks.items?.forEach((track: Record<string, unknown>, index: number) => {
      const artists = track.artists as Array<{ name: string }>
      const album = track.album as { images: Array<{ url: string }> }
      events.push({
        provider: 'spotify',
        event_type: 'top_track',
        occurred_at: new Date().toISOString(),
        month_key: monthKey,
        raw_data: track as Record<string, unknown>,
        display_title: track.name as string,
        display_subtitle: `#${index + 1} · ${artists.map(a => a.name).join(', ')}`,
        thumbnail_url: album?.images?.[0]?.url ?? null,
      })
    })
  } catch (e) {
    console.error('Failed to fetch Spotify top tracks:', e)
  }

  // Recently played within the month window
  try {
    const after = start.getTime()
    const before = end.getTime()
    const recent = await apiGet(`/me/player/recently-played?limit=50&after=${after}`, accessToken)
    const filtered = (recent.items ?? []).filter((item: Record<string, unknown>) => {
      const playedAt = new Date((item.played_at as string)).getTime()
      return playedAt >= after && playedAt <= before
    })
    filtered.forEach((item: Record<string, unknown>) => {
      const track = item.track as Record<string, unknown>
      const artists = track.artists as Array<{ name: string }>
      const album = track.album as { images: Array<{ url: string }> }
      events.push({
        provider: 'spotify',
        event_type: 'recently_played',
        occurred_at: item.played_at as string,
        month_key: toMonthKey(new Date(item.played_at as string)),
        raw_data: item as Record<string, unknown>,
        display_title: track.name as string,
        display_subtitle: artists?.map((a) => a.name).join(', ') ?? null,
        thumbnail_url: album?.images?.[0]?.url ?? null,
      })
    })
  } catch (e) {
    console.error('Failed to fetch Spotify recently played:', e)
  }

  return events
}
