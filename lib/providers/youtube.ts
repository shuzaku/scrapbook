import { encrypt, decrypt } from '@/lib/crypto'
import { monthKeyToRange } from '@/lib/month-key'
import type { Event } from '@/lib/supabase/types'

const BASE = 'https://www.googleapis.com/youtube/v3'
const AUTH_BASE = 'https://accounts.google.com/o/oauth2'
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'].join(' ')

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_BASE}/auth?${params}`
}

export async function exchangeCode(code: string) {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; scope: string }>
}

export async function refreshAccessToken(encryptedRefreshToken: string) {
  const refreshToken = await decrypt(encryptedRefreshToken)
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function encryptTokens(accessToken: string, refreshToken: string) {
  const [encAccess, encRefresh] = await Promise.all([encrypt(accessToken), encrypt(refreshToken)])
  return { encAccess, encRefresh }
}

async function apiGet(path: string, accessToken: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 403) throw new Error('YouTube quota exceeded')
  if (!res.ok) throw new Error(`YouTube API error ${res.status}`)
  return res.json()
}

export async function fetchMonthEvents(accessToken: string, monthKey: string): Promise<Omit<Event, 'id' | 'created_at' | 'user_id'>[]> {
  const { start, end } = monthKeyToRange(monthKey)
  const events: Omit<Event, 'id' | 'created_at' | 'user_id'>[] = []

  // Liked videos playlist
  try {
    const channelRes = await apiGet('/channels?part=contentDetails&mine=true', accessToken)
    const likedPlaylistId = channelRes.items?.[0]?.contentDetails?.relatedPlaylists?.likes
    if (likedPlaylistId) {
      const playlistRes = await apiGet(
        `/playlistItems?part=snippet&playlistId=${likedPlaylistId}&maxResults=50`,
        accessToken
      )
      const items = (playlistRes.items ?? []).filter((item: Record<string, unknown>) => {
        const snippet = item.snippet as Record<string, unknown>
        const publishedAt = new Date(snippet.publishedAt as string)
        return publishedAt >= start && publishedAt <= end
      })
      items.forEach((item: Record<string, unknown>) => {
        const snippet = item.snippet as Record<string, unknown>
        const thumbnails = snippet.thumbnails as Record<string, { url: string }>
        events.push({
          provider: 'youtube',
          event_type: 'liked_video',
          occurred_at: snippet.publishedAt as string,
          month_key: monthKey,
          raw_data: item as Record<string, unknown>,
          display_title: snippet.title as string,
          display_subtitle: snippet.videoOwnerChannelTitle as string,
          thumbnail_url: thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null,
        })
      })
    }
  } catch (e) {
    console.error('Failed to fetch YouTube liked videos:', e)
  }

  return events
}
