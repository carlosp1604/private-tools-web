import { argon2id } from 'hash-wasm'
import { Bytes, decodeBase64Url, encodeBase64Url } from '~/crypto/base64Url'

const KEY_BYTES = 32
const SALT_BYTES = 16
const IV_BYTES = 12
const GCM_TAG_BYTES = 16

export const MAX_CIPHERTEXT_BYTES = 64 * 1024
export const MAX_SECRET_TEXT_BYTES = MAX_CIPHERTEXT_BYTES - GCM_TAG_BYTES

const ARGON2_ITERATIONS = 2
const ARGON2_MEMORY_KIB = 19_456
const ARGON2_PARALLELISM = 1

const SALT_INFO = 'private-tools/secret/v1/salt'
const ENCRYPTION_INFO = 'private-tools/secret/v1/encryption'
const AUTH_INFO = 'private-tools/secret/v1/auth'

export interface SecretKeys {
  encryptionKey: CryptoKey
  authKey: Bytes
}

export interface EncryptedSecret {
  linkKey: string
  iv: string
  ciphertext: string
  authHash: string
}

export interface SecretContent {
  iv: string
  ciphertext: string
}

function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length))
}

function concatBytes(first: Bytes, second: Bytes): Bytes {
  const bytes = new Uint8Array(first.length + second.length)

  bytes.set(first)
  bytes.set(second, first.length)

  return bytes
}

async function hkdf(inputKey: Bytes, info: string, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', inputKey, 'HKDF', false, ['deriveBits'])

  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(info) },
    key,
    length * 8
  )

  return new Uint8Array(bits)
}

/**
 * The salt comes from the link key instead of the server, because the reader needs it before the server releases
 * anything. It is still unique per secret, since each one has its own random link key
 */
export async function deriveSecretKeys(linkKey: Bytes, password: string): Promise<SecretKeys> {
  const salt = await hkdf(linkKey, SALT_INFO, SALT_BYTES)

  const stretchedPassword = await argon2id({
    password: password.normalize('NFKC'),
    salt,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    parallelism: ARGON2_PARALLELISM,
    hashLength: KEY_BYTES,
    outputType: 'binary',
  })

  const inputKey = concatBytes(linkKey, new Uint8Array(stretchedPassword))

  const encryptionKeyBytes = await hkdf(inputKey, ENCRYPTION_INFO, KEY_BYTES)
  const authKey = await hkdf(inputKey, AUTH_INFO, KEY_BYTES)

  const encryptionKey = await crypto.subtle.importKey('raw', encryptionKeyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])

  return { encryptionKey, authKey }
}

export async function hashAuthKey(authKey: Bytes): Promise<string> {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', authKey)))
}

export async function encryptWithIv(text: string, encryptionKey: CryptoKey, iv: Bytes): Promise<string> {
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, new TextEncoder().encode(text))

  return encodeBase64Url(new Uint8Array(ciphertext))
}

export async function encryptSecret(text: string, password: string): Promise<EncryptedSecret> {
  const linkKey = randomBytes(KEY_BYTES)
  const iv = randomBytes(IV_BYTES)
  const { encryptionKey, authKey } = await deriveSecretKeys(linkKey, password)

  return {
    linkKey: encodeBase64Url(linkKey),
    iv: encodeBase64Url(iv),
    ciphertext: await encryptWithIv(text, encryptionKey, iv),
    authHash: await hashAuthKey(authKey),
  }
}

export async function decryptSecret({ iv, ciphertext }: SecretContent, encryptionKey: CryptoKey): Promise<string> {
  const text = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64Url(iv) }, encryptionKey, decodeBase64Url(ciphertext))

  return new TextDecoder().decode(text)
}
