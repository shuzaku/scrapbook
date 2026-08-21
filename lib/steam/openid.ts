/**
 * Signing in through Steam.
 *
 * Steam speaks OpenID 2.0 rather than OAuth: it sends the browser back with a
 * claimed identity, which must then be **checked with Steam directly** before
 * being believed. Reading the SteamID straight out of the query string would
 * let anyone connect as anyone by editing a URL.
 */
import { OPENID } from './config'

export function authUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })
  return `${OPENID}?${params}`
}

/** A SteamID is 17 digits. */
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

/**
 * Confirms the response really came from Steam, and returns the SteamID.
 *
 * The whole set of openid.* parameters is echoed back with mode set to
 * check_authentication; Steam answers `is_valid:true` only if it signed them.
 */
export async function verify(params: URLSearchParams): Promise<string | null> {
  const claimedId = params.get('openid.claimed_id')
  const match = claimedId?.match(CLAIMED_ID)
  if (!match) return null

  const check = new URLSearchParams(params)
  check.set('openid.mode', 'check_authentication')

  const res = await fetch(OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: check,
  })
  if (!res.ok) return null

  const body = await res.text()
  return /is_valid\s*:\s*true/.test(body) ? match[1] : null
}
