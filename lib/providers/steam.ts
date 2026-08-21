import { toMonthKey, monthKeyToRange } from '@/lib/month-key'
import type { Event } from '@/lib/supabase/types'

const BASE = 'https://api.steampowered.com'
// Steam uses OpenID, no OAuth tokens needed — just API key + steamId
const OPENID_BASE = 'https://steamcommunity.com/openid'

export function getAuthUrl(returnTo: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': process.env.NEXT_PUBLIC_APP_URL!,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })
  return `${OPENID_BASE}/login?${params}`
}

export function extractSteamId(searchParams: URLSearchParams): string | null {
  const claimedId = searchParams.get('openid.claimed_id')
  const match = claimedId?.match(/\/id\/(\d+)$/)
  return match?.[1] ?? null
}

async function apiGet(path: string) {
  const url = `${BASE}${path}&key=${process.env.STEAM_API_KEY}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Steam API error ${res.status}`)
  return res.json()
}

export async function getPlayerSummary(steamId: string) {
  const data = await apiGet(`/ISteamUser/GetPlayerSummaries/v2/?steamids=${steamId}`)
  return data.response.players?.[0]
}

export async function fetchMonthEvents(steamId: string, monthKey: string): Promise<Omit<Event, 'id' | 'created_at' | 'user_id'>[]> {
  const { start, end } = monthKeyToRange(monthKey)
  const events: Omit<Event, 'id' | 'created_at' | 'user_id'>[] = []

  try {
    const data = await apiGet(`/IPlayerService/GetRecentlyPlayedGames/v1/?steamid=${steamId}&count=20`)
    const games: Array<Record<string, unknown>> = data.response?.games ?? []
    games.forEach((game) => {
      events.push({
        provider: 'steam',
        event_type: 'game_played',
        occurred_at: new Date().toISOString(),
        month_key: monthKey,
        raw_data: game,
        display_title: game.name as string,
        display_subtitle: `${Math.round((game.playtime_2weeks as number) / 60 * 10) / 10}h this month`,
        thumbnail_url: `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_logo_url}.jpg`,
      })
    })
  } catch (e) {
    console.error('Failed to fetch Steam recently played:', e)
  }

  return events
}

export async function fetchAchievements(steamId: string, appId: number, monthKey: string): Promise<Omit<Event, 'id' | 'created_at' | 'user_id'>[]> {
  const { start, end } = monthKeyToRange(monthKey)
  const events: Omit<Event, 'id' | 'created_at' | 'user_id'>[] = []

  try {
    const data = await apiGet(`/ISteamUserStats/GetPlayerAchievements/v1/?steamid=${steamId}&appid=${appId}`)
    const achievements: Array<Record<string, unknown>> = data.playerstats?.achievements ?? []
    const unlocked = achievements.filter((a) => a.achieved === 1)
    unlocked.forEach((achievement) => {
      const unlockedAt = new Date((achievement.unlocktime as number) * 1000)
      if (toMonthKey(unlockedAt) !== monthKey) return
      events.push({
        provider: 'steam',
        event_type: 'achievement_unlocked',
        occurred_at: unlockedAt.toISOString(),
        month_key: monthKey,
        raw_data: achievement,
        display_title: achievement.name as string,
        display_subtitle: achievement.description as string,
        thumbnail_url: null,
      })
    })
  } catch (e) {
    // Many games have no achievements
  }

  return events
}
