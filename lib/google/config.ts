/**
 * Google Photos integration settings, all optional.
 *
 * Nothing here is required to run the app — when the credentials are missing
 * the integration reports itself as unconfigured and the rest of the journal
 * carries on exactly as before.
 */

/**
 * The Library API's read scopes were closed to third-party apps in 2025, so
 * this integration uses the Picker API: the person chooses photos in Google's
 * own UI and we only ever see what they picked.
 */
export const PICKER_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'

export const PICKER_API = 'https://photospicker.googleapis.com/v1'
export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
export const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

/** Photos are fetched at this bound rather than full size, to keep files sane. */
export const DOWNLOAD_SIZE = '=w2048-h2048'

export interface GoogleConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export function callbackPath(): string {
  return '/api/integrations/google/callback'
}

/** Returns null when the app hasn't been given Google credentials. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  // Placeholder values from .env.example shouldn't count as configured.
  if (!clientId || !clientSecret) return null
  if (clientId.startsWith('your_') || clientSecret.startsWith('your_')) return null

  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_PHOTOS_REDIRECT_URI || `${appUrl()}${callbackPath()}`,
  }
}

export function isGoogleConfigured(): boolean {
  return googleConfig() !== null
}

/** The redirect URI to register in Google Cloud, shown on the settings screen. */
export function expectedRedirectUri(): string {
  return process.env.GOOGLE_PHOTOS_REDIRECT_URI || `${appUrl()}${callbackPath()}`
}
