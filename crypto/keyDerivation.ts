import { argon2id } from 'hash-wasm'
import { Bytes } from '~/crypto/base64Url'

const STRETCHED_PASSWORD_BYTES = 32
const ARGON2_ITERATIONS = 2
const ARGON2_MEMORY_KIB = 19_456
const ARGON2_PARALLELISM = 1

export function concatBytes(...parts: ReadonlyArray<Uint8Array>): Bytes {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))

  let offset = 0

  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }

  return bytes
}

export async function hkdf(inputKey: Bytes, info: string, length: number, salt: Bytes = new Uint8Array(0)): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', inputKey, 'HKDF', false, ['deriveBits'])

  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) },
    key,
    length * 8
  )

  return new Uint8Array(bits)
}

export async function stretchPassword(password: string, salt: Bytes): Promise<Bytes> {
  const stretched = await argon2id({
    password: password.normalize('NFKC'),
    salt,
    iterations: ARGON2_ITERATIONS,
    memorySize: ARGON2_MEMORY_KIB,
    parallelism: ARGON2_PARALLELISM,
    hashLength: STRETCHED_PASSWORD_BYTES,
    outputType: 'binary',
  })

  return new Uint8Array(stretched)
}
