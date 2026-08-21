/**
 * Steam settings.
 *
 * Two halves that work independently: searching the store needs nothing at
 * all, while your own library and achievements need a Web API key and a
 * signed-in SteamID.
 */

export const API = 'https://api.steampowered.com'
export const STORE = 'https://store.steampowered.com'
export const OPENID = 'https://steamcommunity.com/openid/login'

/** Steam's CDN serves game art publicly — no key, no signing. */
export const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps'

export function steamApiKey(): string | null {
  const key = process.env.STEAM_API_KEY
  if (!key || key.startsWith('your_')) return null
  return key
}

export function isSteamConfigured(): boolean {
  return steamApiKey() !== null
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export function callbackPath(): string {
  return '/api/integrations/steam/callback'
}

export function expectedReturnUrl(): string {
  return `${appUrl()}${callbackPath()}`
}

/** Portrait box art — the nicest of the sizes for a page. */
export function boxArtUrl(appId: number | string): string {
  return `${CDN}/${appId}/library_600x900_2x.jpg`
}

/** The wide banner, for a card. */
export function headerArtUrl(appId: number | string): string {
  return `${CDN}/${appId}/header.jpg`
}

export function storePageUrl(appId: number | string): string {
  return `${STORE}/app/${appId}`
}
