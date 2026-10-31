import { displayNameFromValues } from '~/helpers/displayName'
import { Bytes, encodeBase64Url } from '~/crypto/base64Url'
import { concatBytes, hkdf } from '~/crypto/keyDerivation'

const NONCE_BYTES = 32
const NAME_BYTES = 12
const NAMES_INFO = 'private-tools/transfer/v1/names'
const FINGERPRINT_REGEX = /^a=fingerprint:(\S+ [0-9A-Fa-f:]+)\s*$/m

export interface VerificationNames {
  sender: string
  receiver: string
}

export function generateNonce(): Bytes {
  return crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
}

/**
 * Reads the fingerprint of the DTLS certificate from a session description. It identifies the end of the connection
 */
export function parseFingerprint(sdp: string): string | null {
  return FINGERPRINT_REGEX.exec(sdp)?.[1]?.toUpperCase() ?? null
}

async function sha256(data: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

/**
 * Each side binds itself to its certificate before seeing the other one. Without this step, an intermediary could
 * try certificates until it found one that produces the expected name
 */
export async function createCommitment(nonce: Bytes, fingerprint: string): Promise<string> {
  return encodeBase64Url(await sha256(concatBytes(nonce, new TextEncoder().encode(fingerprint))))
}

function namesFromBytes(bytes: Bytes): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  return displayNameFromValues(view.getUint32(0), view.getUint32(4), view.getUint32(8))
}

/**
 * Both sides compute the same two names. An intermediary would leave each side with a different certificate pair
 * and, as a result, with different names
 */
export async function deriveVerificationNames(
  senderNonce: Bytes,
  receiverNonce: Bytes,
  senderFingerprint: string,
  receiverFingerprint: string
): Promise<VerificationNames> {
  const fingerprints = new TextEncoder().encode(`${senderFingerprint}|${receiverFingerprint}`)
  const bytes = await hkdf(concatBytes(senderNonce, receiverNonce, fingerprints), NAMES_INFO, NAME_BYTES * 2)

  return { sender: namesFromBytes(bytes.slice(0, NAME_BYTES)), receiver: namesFromBytes(bytes.slice(NAME_BYTES)) }
}
