import { decodeBase64Url, encodeBase64Url } from '~/crypto/base64Url'
import {
  confirmationsMatch,
  decryptMessage,
  deriveRoomKeys,
  encryptMessage,
  establishChannel,
  generateEphemeralKeys,
  generateSessionCode,
  MAX_MESSAGE_BYTES,
  normalizeSessionCode
} from '~/crypto/chatCrypto'

const GCM_TAG_BYTES = 16

describe('chatCrypto', () => {
  jest.setTimeout(20_000)

  const authKey = decodeBase64Url('c6okGINDksH1GaN8SyJi0PJ-Xx5nxaJJG7HOhEW8ulg')

  const establishBoth = async (firstAuthKey = authKey, secondAuthKey = authKey) => {
    const first = await generateEphemeralKeys()
    const second = await generateEphemeralKeys()

    return {
      first: await establishChannel(first, second.publicKey, firstAuthKey),
      second: await establishChannel(second, first.publicKey, secondAuthKey),
    }
  }

  describe('deriveRoomKeys', () => {
    // Generated with argon2-cffi and Python's hmac and hashlib, so the code is not checked against itself
    it('should match the known vector', async () => {
      const { roomId, authKey: derivedAuthKey } = await deriveRoomKeys('ABCD-2345-EFGH-6789', 'contraseña')

      expect(roomId).toBe('d0uHlvP3I5U_KOhG1k15NzPjRAHloxAEqzS3Tec8vz0')
      expect(encodeBase64Url(derivedAuthKey)).toBe('c6okGINDksH1GaN8SyJi0PJ-Xx5nxaJJG7HOhEW8ulg')
    })

    it('should give the same room however the code is typed', async () => {
      const typed = await deriveRoomKeys(' abcd 2345-efgh 6789 ', 'contraseña')

      expect(typed.roomId).toBe('d0uHlvP3I5U_KOhG1k15NzPjRAHloxAEqzS3Tec8vz0')
    })

    it('should give another room with another password', async () => {
      const { roomId } = await deriveRoomKeys('ABCD-2345-EFGH-6789', 'other')

      expect(roomId).not.toBe('d0uHlvP3I5U_KOhG1k15NzPjRAHloxAEqzS3Tec8vz0')
    })

    it('should produce a room id the server accepts', async () => {
      const { roomId } = await deriveRoomKeys('code', 'password')

      expect(roomId).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })
  })

  describe('generateSessionCode', () => {
    it('should use 16 characters without ambiguous ones', () => {
      expect(generateSessionCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/)
    })

    it('should not repeat', () => {
      expect(new Set(Array.from({ length: 50 }, generateSessionCode)).size).toBe(50)
    })

    it('should be normalized to a code without separators', () => {
      expect(normalizeSessionCode('ab-cd 12')).toBe('ABCD12')
    })
  })

  describe('establishChannel', () => {
    it('should let each side read what the other one sends', async () => {
      const { first, second } = await establishBoth()

      const fromFirst = await encryptMessage('hola', first.sendKey, 0)
      const fromSecond = await encryptMessage('hallo', second.sendKey, 0)

      expect(await decryptMessage(fromFirst, second.receiveKey, 0)).toBe('hola')
      expect(await decryptMessage(fromSecond, first.receiveKey, 0)).toBe('hallo')
    })

    it('should use a different key per direction', async () => {
      const { first } = await establishBoth()

      const ciphertext = await encryptMessage('hola', first.sendKey, 0)

      await expect(decryptMessage(ciphertext, first.receiveKey, 0)).rejects.toThrow()
    })

    it('should confirm each side to the other', async () => {
      const { first, second } = await establishBoth()

      expect(confirmationsMatch(first.confirmation, second.expectedConfirmation)).toBe(true)
      expect(confirmationsMatch(second.confirmation, first.expectedConfirmation)).toBe(true)
    })

    it('should not confirm a side with another auth key', async () => {
      const { first, second } = await establishBoth(authKey, new Uint8Array(32))

      expect(confirmationsMatch(first.confirmation, second.expectedConfirmation)).toBe(false)
    })

    it('should reject an invalid public key', async () => {
      const keys = await generateEphemeralKeys()

      await expect(establishChannel(keys, new Uint8Array(65), authKey)).rejects.toThrow()
    })

    it('should give new keys to every connection', async () => {
      const first = await generateEphemeralKeys()
      const second = await generateEphemeralKeys()

      expect(first.publicKey).not.toStrictEqual(second.publicKey)
    })
  })

  describe('messages', () => {
    it.each([
      ['a short text', 1, 256],
      ['the largest text of the first size', 244, 256],
      ['the smallest text of the second size', 245, 1024],
      ['the smallest text of the third size', 1013, MAX_MESSAGE_BYTES + 12],
      ['the longest text', MAX_MESSAGE_BYTES, MAX_MESSAGE_BYTES + 12],
    ])('should hide the length of %s', async (_case, length, paddedSize) => {
      const { first, second } = await establishBoth()
      const text = 'a'.repeat(length)

      const ciphertext = await encryptMessage(text, first.sendKey, 0)

      expect(ciphertext).toHaveLength(paddedSize + GCM_TAG_BYTES)
      expect(await decryptMessage(ciphertext, second.receiveKey, 0)).toBe(text)
    })

    it('should fit in the largest frame the server forwards', async () => {
      const { first } = await establishBoth()

      const ciphertext = await encryptMessage('a'.repeat(MAX_MESSAGE_BYTES), first.sendKey, 0)

      expect(ciphertext.length + 1).toBeLessThanOrEqual(5 * 1024)
    })

    it('should refuse a text above the limit', async () => {
      const { first } = await establishBoth()

      await expect(encryptMessage('a'.repeat(MAX_MESSAGE_BYTES + 1), first.sendKey, 0)).rejects.toThrow()
    })

    it('should keep multibyte text intact', async () => {
      const { first, second } = await establishBoth()

      const ciphertext = await encryptMessage('ñandú 🔐', first.sendKey, 0)

      expect(await decryptMessage(ciphertext, second.receiveKey, 0)).toBe('ñandú 🔐')
    })

    it('should reject a replayed message', async () => {
      const { first, second } = await establishBoth()

      const ciphertext = await encryptMessage('hola', first.sendKey, 0)

      await expect(decryptMessage(ciphertext, second.receiveKey, 1)).rejects.toThrow()
    })

    it('should encrypt the same text differently each time', async () => {
      const { first } = await establishBoth()

      const firstMessage = await encryptMessage('hola', first.sendKey, 0)
      const secondMessage = await encryptMessage('hola', first.sendKey, 1)

      expect(firstMessage).not.toStrictEqual(secondMessage)
    })
  })
})
