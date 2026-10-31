import { decodeBase64Url, encodeBase64Url } from '~/crypto/base64Url'
import {
  decryptSecret,
  deriveSecretKeys,
  encryptSecret,
  encryptWithIv,
  hashAuthKey,
  MAX_CIPHERTEXT_BYTES,
  MAX_SECRET_TEXT_BYTES
} from '~/crypto/secretCrypto'

// Generated with argon2-cffi and Python's hmac, hashlib and cryptography, so the code is not checked against itself
const VECTOR = {
  linkKey: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8',
  iv: 'ZGVmZ2hpamtsbW5v',
  password: 'contraseña correcta',
  text: 'texto secreto ✓',
  authKey: 'Va8CK5vWuqpJlE9wsp8CFstS88cpUvWTbQlLgNNrVoU',
  authHash: 'c1h3e5FjE8Rw7deiYM4OGeBR0mUqEbpy2Yn_DL5Yw5s',
  ciphertext: 'to0GnHKyM75JX-t4GVKSis2JX6Z662s3CYwc0GU_mGSt',
}

describe('secretCrypto', () => {
  jest.setTimeout(20_000)

  describe('known vector', () => {
    it('should derive the expected auth key and hash', async () => {
      const { authKey } = await deriveSecretKeys(decodeBase64Url(VECTOR.linkKey), VECTOR.password)

      expect(encodeBase64Url(authKey)).toBe(VECTOR.authKey)
      expect(await hashAuthKey(authKey)).toBe(VECTOR.authHash)
    })

    it('should produce the expected ciphertext', async () => {
      const { encryptionKey } = await deriveSecretKeys(decodeBase64Url(VECTOR.linkKey), VECTOR.password)

      expect(await encryptWithIv(VECTOR.text, encryptionKey, decodeBase64Url(VECTOR.iv))).toBe(VECTOR.ciphertext)
    })

    it('should decrypt the expected text', async () => {
      const { encryptionKey } = await deriveSecretKeys(decodeBase64Url(VECTOR.linkKey), VECTOR.password)

      expect(await decryptSecret(VECTOR, encryptionKey)).toBe(VECTOR.text)
    })
  })

  describe('encryptSecret', () => {
    it('should let the reader recover the text with the link key and the password', async () => {
      const secret = await encryptSecret('¡hola! 🔐', 'password')

      const { encryptionKey, authKey } = await deriveSecretKeys(decodeBase64Url(secret.linkKey), 'password')

      expect(await hashAuthKey(authKey)).toBe(secret.authHash)
      expect(await decryptSecret(secret, encryptionKey)).toBe('¡hola! 🔐')
    })

    it('should use a new link key and iv for every secret', async () => {
      const first = await encryptSecret('text', 'password')
      const second = await encryptSecret('text', 'password')

      expect(first.linkKey).not.toBe(second.linkKey)
      expect(first.iv).not.toBe(second.iv)
      expect(first.ciphertext).not.toBe(second.ciphertext)
    })

    it('should match the sizes the server requires', async () => {
      const secret = await encryptSecret('text', 'password')

      expect(decodeBase64Url(secret.linkKey)).toHaveLength(32)
      expect(decodeBase64Url(secret.iv)).toHaveLength(12)
      expect(decodeBase64Url(secret.authHash)).toHaveLength(32)
    })

    it('should stay within the server limit with the largest text', async () => {
      const secret = await encryptSecret('a'.repeat(MAX_SECRET_TEXT_BYTES), 'password')

      expect(decodeBase64Url(secret.ciphertext)).toHaveLength(MAX_CIPHERTEXT_BYTES)
    })
  })

  describe('with wrong data', () => {
    it('should derive a different auth key from a wrong password', async () => {
      const linkKey = decodeBase64Url(VECTOR.linkKey)

      const { authKey } = await deriveSecretKeys(linkKey, 'wrong password')

      expect(await hashAuthKey(authKey)).not.toBe(VECTOR.authHash)
    })

    it('should derive a different auth key from a wrong link key', async () => {
      const linkKey = decodeBase64Url(VECTOR.linkKey)

      linkKey[0] = 255

      const { authKey } = await deriveSecretKeys(linkKey, VECTOR.password)

      expect(await hashAuthKey(authKey)).not.toBe(VECTOR.authHash)
    })

    it('should reject a tampered ciphertext', async () => {
      const { encryptionKey } = await deriveSecretKeys(decodeBase64Url(VECTOR.linkKey), VECTOR.password)
      const tampered = decodeBase64Url(VECTOR.ciphertext)

      tampered[0] = (tampered[0] ?? 0) ^ 1

      await expect(decryptSecret({ iv: VECTOR.iv, ciphertext: encodeBase64Url(tampered) }, encryptionKey)).rejects.toThrow()
    })
  })

  it('should treat equivalent unicode forms of a password as the same password', async () => {
    const linkKey = decodeBase64Url(VECTOR.linkKey)

    const composed = await deriveSecretKeys(linkKey, 'ñ')
    const decomposed = await deriveSecretKeys(linkKey, 'ñ')

    expect(encodeBase64Url(composed.authKey)).toBe(encodeBase64Url(decomposed.authKey))
  })
})
