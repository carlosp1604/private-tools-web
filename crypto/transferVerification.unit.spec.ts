import { createCommitment, deriveVerificationNames, generateNonce, parseFingerprint } from '~/crypto/transferVerification'

describe('transferVerification', () => {
  const sdp = 'v=0\r\na=ice-ufrag:abc\r\na=fingerprint:sha-256 AB:cd:12\r\na=setup:actpass\r\n'
  const senderNonce = new Uint8Array(32).fill(1)
  const receiverNonce = new Uint8Array(32).fill(2)

  describe('parseFingerprint', () => {
    it('should read the fingerprint in a stable form', () => {
      expect(parseFingerprint(sdp)).toBe('SHA-256 AB:CD:12')
    })

    it('should find nothing in a description without it', () => {
      expect(parseFingerprint('v=0\r\n')).toBeNull()
    })
  })

  describe('createCommitment', () => {
    it('should depend on the nonce and on the fingerprint', async () => {
      const commitment = await createCommitment(senderNonce, 'SHA-256 AA')

      expect(await createCommitment(senderNonce, 'SHA-256 AA')).toBe(commitment)
      expect(await createCommitment(receiverNonce, 'SHA-256 AA')).not.toBe(commitment)
      expect(await createCommitment(senderNonce, 'SHA-256 BB')).not.toBe(commitment)
    })

    it('should fit in a link fragment', async () => {
      expect(await createCommitment(generateNonce(), 'SHA-256 AA')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })
  })

  describe('deriveVerificationNames', () => {
    it('should give the same names to both sides', async () => {
      const first = await deriveVerificationNames(senderNonce, receiverNonce, 'SHA-256 AA', 'SHA-256 BB')
      const second = await deriveVerificationNames(senderNonce, receiverNonce, 'SHA-256 AA', 'SHA-256 BB')

      expect(first).toStrictEqual(second)
      expect(first.sender).not.toBe(first.receiver)
    })

    it('should change with any other certificate', async () => {
      const honest = await deriveVerificationNames(senderNonce, receiverNonce, 'SHA-256 AA', 'SHA-256 BB')
      const intercepted = await deriveVerificationNames(senderNonce, receiverNonce, 'SHA-256 AA', 'SHA-256 CC')

      expect(intercepted.receiver).not.toBe(honest.receiver)
    })
  })
})
