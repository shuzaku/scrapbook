/** The Steam connection: a verified SteamID, no tokens involved. */
import {
  accountIdFor,
  clearConnection,
  connectionStatus,
  saveAccountConnection,
  type ConnectionStatus,
} from '@/lib/connections'
import { isSteamConfigured } from './config'

export async function saveSteamConnection(steamId: string, label: string | null): Promise<void> {
  await saveAccountConnection('steam', { accountId: steamId, label })
}

export async function clearSteamConnection(): Promise<void> {
  await clearConnection('steam')
}

export async function steamStatus(): Promise<ConnectionStatus> {
  return connectionStatus('steam', isSteamConfigured())
}

export async function connectedSteamId(): Promise<string | null> {
  return accountIdFor('steam')
}
