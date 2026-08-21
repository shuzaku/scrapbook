/**
 * The one part of this journal that leaves the machine.
 *
 * Everything else here is deliberately local: photos, covers and routes are
 * downloaded and kept in `.data/`, and the app runs with no accounts at all.
 * Asking for suggestions is different — the entry's words are sent to
 * Anthropic to be read. So it is off unless a key is set, it only ever runs
 * when someone presses the button, and the panel says as much before they do.
 */

export function anthropicKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || key.startsWith('your_')) return null
  return key
}

export function isAiConfigured(): boolean {
  return anthropicKey() !== null
}

/**
 * Which model does the reading.
 *
 * Overridable for anyone who would rather spend less per suggestion, but the
 * default is the capable one — a good suggestion is worth more than a cheap
 * one, and an entry is a few hundred words.
 */
export function suggestModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-opus-5'
}
