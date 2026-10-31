import { Bytes, encodeBase64Url } from '~/crypto/base64Url'
import { concatBytes, hkdf, stretchPassword } from '~/crypto/keyDerivation'

const ROOM_ID_BYTES = 32
const AUTH_KEY_BYTES = 32
const DIRECTION_KEY_BYTES = 32

const SESSION_CODE_LENGTH = 16
const SESSION_CODE_GROUP = 4
const SESSION_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const ROOM_SALT = new TextEncoder().encode('private-tools/v1')
const ROOM_INFO = 'private-tools/chat/v1/room'
const AUTH_INFO = 'private-tools/chat/v1/auth'
const LOW_TO_HIGH_INFO = 'private-tools/chat/v1/low-to-high'
const HIGH_TO_LOW_INFO = 'private-tools/chat/v1/high-to-low'
const LOW_CONFIRMATION = new TextEncoder().encode('private-tools/chat/v1/confirm/low')
const HIGH_CONFIRMATION = new TextEncoder().encode('private-tools/chat/v1/confirm/high')

const SEQUENCE_BYTES = 8
const LENGTH_BYTES = 4
const HEADER_BYTES = SEQUENCE_BYTES + LENGTH_BYTES
const NONCE_BYTES = 12

export const MAX_MESSAGE_BYTES = 4096

// Every message is padded to one of these sizes, so its real length does not leak
const PADDED_SIZES = [256, 1024, MAX_MESSAGE_BYTES + HEADER_BYTES]

export interface RoomKeys {
  roomId: string
  authKey: Bytes
}

export interface EphemeralKeys {
  privateKey: CryptoKey
  publicKey: Bytes
}

export interface ChatChannel {
  sendKey: CryptoKey
  receiveKey: CryptoKey
  confirmation: Bytes
  expectedConfirmation: Bytes
}

export function normalizeSessionCode(sessionCode: string): string {
  return sessionCode.replace(/[\s-]/g, '').toUpperCase()
}

export function generateSessionCode(): string {
  const characters = Array.from(
    crypto.getRandomValues(new Uint8Array(SESSION_CODE_LENGTH)),
    (byte) => SESSION_CODE_ALPHABET.charAt(byte % SESSION_CODE_ALPHABET.length)
  )

  const groups = Array.from(
    { length: SESSION_CODE_LENGTH / SESSION_CODE_GROUP },
    (_, index) => characters.slice(index * SESSION_CODE_GROUP, (index + 1) * SESSION_CODE_GROUP).join('')
  )

  return groups.join('-')
}

export async function deriveRoomKeys(sessionCode: string, password: string): Promise<RoomKeys> {
  const stretched = await stretchPassword(`${normalizeSessionCode(sessionCode)}\0${password}`, ROOM_SALT)

  return {
    roomId: encodeBase64Url(await hkdf(stretched, ROOM_INFO, ROOM_ID_BYTES)),
    authKey: await hkdf(stretched, AUTH_INFO, AUTH_KEY_BYTES),
  }
}

export async function generateEphemeralKeys(): Promise<EphemeralKeys> {
  const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])

  return { privateKey, publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)) }
}

function isLowerThan(first: Bytes, second: Bytes): boolean {
  const index = first.findIndex((byte, position) => byte !== second[position])

  return index !== -1 && (first[index] ?? 0) < (second[index] ?? 0)
}

async function sign(authKey: Bytes, label: Bytes, transcript: Bytes): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', authKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  return new Uint8Array(await crypto.subtle.sign('HMAC', key, concatBytes(label, transcript)))
}

async function importDirectionKey(sharedSecret: Bytes, info: string, salt: Bytes): Promise<CryptoKey> {
  const key = await hkdf(sharedSecret, info, DIRECTION_KEY_BYTES, salt)

  return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/**
 * Both sides sort the public keys the same way, which gives each one its direction without the server assigning it.
 * The confirmations prove that the other side holds the auth key and saw the same public keys, so a server that
 * swaps them is detected. The auth key also salts the channel keys, which ties them to the session and the password
 */
export async function establishChannel(keys: EphemeralKeys, peerPublicKey: Bytes, authKey: Bytes): Promise<ChatChannel> {
  const importedPeerKey = await crypto.subtle.importKey('raw', peerPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: importedPeerKey }, keys.privateKey, 256)
  const sharedSecret = new Uint8Array(sharedBits)

  const isLow = isLowerThan(keys.publicKey, peerPublicKey)
  const transcript = isLow ? concatBytes(keys.publicKey, peerPublicKey) : concatBytes(peerPublicKey, keys.publicKey)

  const channelSalt = await hkdf(concatBytes(authKey, transcript), 'private-tools/chat/v1/salt', DIRECTION_KEY_BYTES)
  const lowToHigh = await importDirectionKey(sharedSecret, LOW_TO_HIGH_INFO, channelSalt)
  const highToLow = await importDirectionKey(sharedSecret, HIGH_TO_LOW_INFO, channelSalt)

  const lowConfirmation = await sign(authKey, LOW_CONFIRMATION, transcript)
  const highConfirmation = await sign(authKey, HIGH_CONFIRMATION, transcript)

  return {
    sendKey: isLow ? lowToHigh : highToLow,
    receiveKey: isLow ? highToLow : lowToHigh,
    confirmation: isLow ? lowConfirmation : highConfirmation,
    expectedConfirmation: isLow ? highConfirmation : lowConfirmation,
  }
}

export function confirmationsMatch(received: Bytes, expected: Bytes): boolean {
  if (received.length !== expected.length) {
    return false
  }

  return received.reduce((difference, byte, index) => difference | (byte ^ (expected[index] ?? 0)), 0) === 0
}

function nonceFor(sequence: number): Bytes {
  const nonce = new Uint8Array(NONCE_BYTES)

  new DataView(nonce.buffer).setBigUint64(NONCE_BYTES - SEQUENCE_BYTES, BigInt(sequence))

  return nonce
}

function paddedSizeFor(length: number): number {
  const size = PADDED_SIZES.find((candidate) => length <= candidate)

  if (!size) {
    throw new Error('The message is too long')
  }

  return size
}

export async function encryptMessage(text: string, key: CryptoKey, sequence: number): Promise<Bytes> {
  const encoded = new TextEncoder().encode(text)
  const plaintext = new Uint8Array(paddedSizeFor(HEADER_BYTES + encoded.length))
  const view = new DataView(plaintext.buffer)

  view.setBigUint64(0, BigInt(sequence))
  view.setUint32(SEQUENCE_BYTES, encoded.length)
  plaintext.set(encoded, HEADER_BYTES)

  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceFor(sequence) }, key, plaintext))
}

export async function decryptMessage(ciphertext: Bytes, key: CryptoKey, sequence: number): Promise<string> {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonceFor(sequence) }, key, ciphertext)
  const view = new DataView(plaintext)

  if (view.getBigUint64(0) !== BigInt(sequence)) {
    throw new Error('Unexpected message sequence')
  }

  return new TextDecoder().decode(new Uint8Array(plaintext, HEADER_BYTES, view.getUint32(SEQUENCE_BYTES)))
}
