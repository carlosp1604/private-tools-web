import { Bytes, decodeBase64Url } from '~/crypto/base64Url'

const LINK_KEY_BYTES = 32
const LINK_KEY_REGEX = /^[A-Za-z0-9_-]{43}$/

export function buildSecretLink(origin: string, id: string, linkKey: string): string {
  return `${origin}/s/${id}#${linkKey}`
}

export function parseLinkKey(hash: string): Bytes | null {
  const encodedKey = hash.replace(/^#/, '')

  if (!LINK_KEY_REGEX.test(encodedKey)) {
    return null
  }

  const linkKey = decodeBase64Url(encodedKey)

  return linkKey.length === LINK_KEY_BYTES ? linkKey : null
}
