// AES-256-GCM encryption for OAuth tokens stored in the database

const ALG = 'AES-GCM'
const IV_LENGTH = 12

function getKey(): Promise<CryptoKey> {
  const hex = process.env.TOKEN_ENCRYPTION_KEY!
  if (!hex || hex.length !== 64) throw new Error('TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)')
  const keyBytes = Buffer.from(hex, 'hex')
  return crypto.subtle.importKey('raw', keyBytes, ALG, false, ['encrypt', 'decrypt'])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: ALG, iv }, key, encoded)
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), IV_LENGTH)
  return Buffer.from(combined).toString('base64')
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await getKey()
  const combined = Buffer.from(encoded, 'base64')
  const iv = combined.subarray(0, IV_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH)
  const plaintext = await crypto.subtle.decrypt({ name: ALG, iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}
