/**
 * Reading a Steam library.
 *
 * Store search works with no credentials at all. Your own recently-played
 * games and achievements need a Web API key and a signed-in SteamID — and a
 * profile whose game details are public, or Steam returns nothing rather than
 * an error.
 */
import { API, STORE, boxArtUrl, headerArtUrl, steamApiKey, storePageUrl } from './config'

export interface GameResult {
  appId: number
  name: string
  /** Portrait box art and wide banner, both from Steam's public CDN. */
  boxArt: string
  headerArt: string
  url: string
  /** Minutes played in the last two weeks, when it came from your library. */
  minutesRecent: number | null
  minutesTotal: number | null
}

export interface Achievement {
  key: string
  name: string
  description: string
  /** The unlocked icon, from Steam's CDN. */
  icon: string
  /** ISO timestamp of when it was unlocked. */
  unlockedAt: string
  /** Share of players who have this one, if Steam publishes it. */
  percent: number | null
}

export interface Screenshot {
  id: number
  thumb: string
  full: string
}

export class SteamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'SteamError'
  }
}

function game(appId: number, name: string, recent?: number, total?: number): GameResult {
  return {
    appId,
    name,
    boxArt: boxArtUrl(appId),
    headerArt: headerArtUrl(appId),
    url: storePageUrl(appId),
    minutesRecent: recent ?? null,
    minutesTotal: total ?? null,
  }
}

/**
 * How many players have each achievement in a game.
 *
 * Public — no key — which is why rarity can be shown even when the rest of the
 * library is out of reach.
 */
export async function achievementRarity(appId: number): Promise<Map<string, number>> {
  const rarity = new Map<string, number>()
  try {
    const res = await fetch(
      `${API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appId}&format=json`,
      { cache: 'no-store' }
    )
    if (!res.ok) return rarity

    const data = (await res.json()) as {
      achievementpercentages?: { achievements?: { name?: string; percent?: string | number }[] }
    }
    for (const entry of data.achievementpercentages?.achievements ?? []) {
      const percent = Number(entry.percent)
      if (entry.name && Number.isFinite(percent)) rarity.set(entry.name, percent)
    }
  } catch {
    // Rarity is a nicety; a page shouldn't fail for the want of it.
  }
  return rarity
}

/** The official screenshots on a game's store page. Needs no key. */
export async function gameScreenshots(appId: number): Promise<Screenshot[]> {
  const res = await fetch(`${STORE}/api/appdetails?appids=${appId}`, { cache: 'no-store' })
  if (!res.ok) throw new SteamError(`Could not read that store page (${res.status})`, res.status)

  const body = (await res.json()) as Record<
    string,
    { success?: boolean; data?: { screenshots?: { id?: number; path_thumbnail?: string; path_full?: string }[] } }
  >
  const entry = body[String(appId)]
  if (!entry?.success) return []

  return (entry.data?.screenshots ?? []).flatMap((shot) =>
    shot.path_full && shot.path_thumbnail
      ? [{ id: shot.id ?? 0, thumb: shot.path_thumbnail, full: shot.path_full }]
      : []
  )
}

/* ---------------------------------------------------------------- search -- */

interface RawStoreItem {
  id?: number
  name?: string
}

/** Finds a game by name. Needs no key — this is the public store search. */
export async function searchGames(term: string): Promise<GameResult[]> {
  const params = new URLSearchParams({ term, cc: 'us', l: 'en' })
  const res = await fetch(`${STORE}/api/storesearch/?${params}`, { cache: 'no-store' })

  if (!res.ok) throw new SteamError(`Game search failed (${res.status})`, res.status)

  const data = (await res.json()) as { items?: RawStoreItem[] }
  return (data.items ?? []).flatMap((item) =>
    item.id && item.name ? [game(item.id, item.name)] : []
  )
}

/* --------------------------------------------------------------- library -- */

async function call<T>(path: string): Promise<T> {
  const key = steamApiKey()
  if (!key) throw new SteamError('Steam is not configured', 501)

  const res = await fetch(`${API}${path}&key=${key}&format=json`, { cache: 'no-store' })

  if (res.status === 403) {
    throw new SteamError(
      'Steam refused that request — check the API key, and that your profile’s game details are public.',
      403
    )
  }
  if (!res.ok) throw new SteamError(`Steam request failed (${res.status})`, res.status)

  return (await res.json()) as T
}

interface RawGames {
  response?: {
    games?: { appid?: number; name?: string; playtime_2weeks?: number; playtime_forever?: number }[]
  }
}

/** Games played in the last two weeks, most played first. */
export async function recentlyPlayed(steamId: string, count = 12): Promise<GameResult[]> {
  const data = await call<RawGames>(
    `/IPlayerService/GetRecentlyPlayedGames/v1/?steamid=${steamId}&count=${count}`
  )

  return (data.response?.games ?? []).flatMap((raw) =>
    raw.appid && raw.name
      ? [game(raw.appid, raw.name, raw.playtime_2weeks, raw.playtime_forever)]
      : []
  )
}

interface RawAchievements {
  playerstats?: {
    success?: boolean
    error?: string
    achievements?: {
      apiname?: string
      achieved?: number
      unlocktime?: number
      name?: string
      description?: string
    }[]
  }
}

interface RawSchema {
  game?: {
    availableGameStats?: {
      achievements?: { name?: string; displayName?: string; description?: string; icon?: string }[]
    }
  }
}

/**
 * Achievements you've unlocked in a game, newest first.
 *
 * Two calls: the player's progress, and the game's schema for the icons. A
 * game with no achievements answers with an error string rather than an empty
 * list, which is treated as "none" rather than a failure.
 */
export async function unlockedAchievements(
  steamId: string,
  appId: number,
  limit = 24
): Promise<Achievement[]> {
  const stats = await call<RawAchievements>(
    `/ISteamUserStats/GetPlayerAchievements/v1/?steamid=${steamId}&appid=${appId}&l=en`
  )

  if (stats.playerstats?.success === false) return []

  const unlocked = (stats.playerstats?.achievements ?? []).filter((a) => a.achieved === 1)
  if (unlocked.length === 0) return []

  const [schema, rarity] = await Promise.all([
    call<RawSchema>(`/ISteamUserStats/GetSchemaForGame/v2/?appid=${appId}`),
    achievementRarity(appId),
  ])
  const icons = new Map<string, { icon?: string; displayName?: string; description?: string }>()
  for (const entry of schema.game?.availableGameStats?.achievements ?? []) {
    if (entry.name) icons.set(entry.name, entry)
  }

  return unlocked
    .sort((a, b) => (b.unlocktime ?? 0) - (a.unlocktime ?? 0))
    .slice(0, limit)
    .flatMap((raw): Achievement[] => {
      const key = raw.apiname
      if (!key) return []
      const meta = icons.get(key)
      return [
        {
          key,
          name: raw.name || meta?.displayName || key,
          description: raw.description || meta?.description || '',
          icon: meta?.icon ?? '',
          unlockedAt: raw.unlocktime ? new Date(raw.unlocktime * 1000).toISOString() : '',
          percent: rarity.get(key) ?? null,
        },
      ]
    })
}

/** The display name on the account, for showing which one is connected. */
export async function playerName(steamId: string): Promise<string | null> {
  try {
    const data = await call<{ response?: { players?: { personaname?: string }[] } }>(
      `/ISteamUser/GetPlayerSummaries/v2/?steamids=${steamId}`
    )
    return data.response?.players?.[0]?.personaname ?? null
  } catch {
    return null
  }
}
