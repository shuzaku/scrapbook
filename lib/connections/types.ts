/**
 * The shape of a connected account, shared by both backings.
 *
 * Kept in its own file so the local and cloud modules can both import it
 * without either importing the other.
 */

export type Provider = 'google' | 'spotify' | 'steam' | 'strava'

export interface StoredConnection {
  /**
   * Token-based providers only. Steam has no tokens at all — it signs you in
   * through OpenID and the app calls its API with its own key afterwards.
   */
  refreshToken?: string
  /** True when refreshToken is ciphertext from lib/crypto. */
  encrypted?: boolean
  accessToken?: string | null
  /** Epoch milliseconds. */
  expiresAt?: number
  /** An account identifier that isn't a secret, such as a SteamID. */
  accountId?: string
  /** Something to show for the account — an email, a display name. */
  label: string | null
  connectedAt: string
  /** Older Google records used this name for the label. */
  email?: string | null
}

export interface ConnectionStatus {
  state: 'unconfigured' | 'disconnected' | 'connected'
  label?: string | null
  connectedAt?: string
  /** True when the refresh token is stored as plain text. */
  plaintext?: boolean
}

export interface SaveTokens {
  refreshToken: string
  accessToken: string
  expiresIn: number
  label: string | null
}
