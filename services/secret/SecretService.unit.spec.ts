import { createSecret, readSecret, SECRET_NOT_FOUND } from '~/services/secret/SecretService'

describe('SecretService', () => {
  const fetchMock = jest.fn<Promise<Partial<Response>>, [string, RequestInit]>()

  const respondWith = (status: number, body: unknown) => {
    fetchMock.mockResolvedValue({ status, json: () => Promise.resolve(body) })
  }

  const payload = { iv: 'iv', ciphertext: 'ciphertext', authHash: 'hash', timeToLiveSeconds: 60, maxViews: 1 }

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  describe('createSecret', () => {
    it('should return the id assigned by the server', async () => {
      respondWith(201, { id: 'secret-id' })

      expect(await createSecret(payload)).toStrictEqual({ success: true, value: 'secret-id' })
    })

    it('should send nothing but the encrypted payload', async () => {
      respondWith(201, { id: 'secret-id' })

      await createSecret(payload)

      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1].body))).toStrictEqual(payload)
    })

    it.each([
      ['a rejection', 422, { code: 'create_secret_invalid_input' }, 'rejected'],
      ['a server error', 500, { code: 'internal_error' }, 'invalid_response'],
      ['a success without id', 201, {}, 'invalid_response'],
      ['a success with an unexpected id', 201, { id: 1 }, 'invalid_response'],
    ])('should report %s', async (_case, status, body, expected) => {
      respondWith(status, body)

      expect(await createSecret(payload)).toStrictEqual({ success: false, error: expected })
    })

    it('should report a network failure', async () => {
      fetchMock.mockRejectedValue(new TypeError('failed'))

      expect(await createSecret(payload)).toStrictEqual({ success: false, error: 'network' })
    })
  })

  describe('readSecret', () => {
    it('should return the encrypted content', async () => {
      respondWith(200, { iv: 'iv', ciphertext: 'ciphertext' })

      expect(await readSecret('id', 'key')).toStrictEqual({ success: true, value: { iv: 'iv', ciphertext: 'ciphertext' } })
    })

    it('should report the only failure the server exposes', async () => {
      respondWith(404, { code: SECRET_NOT_FOUND })

      expect(await readSecret('id', 'key')).toStrictEqual({ success: false, error: 'not_found' })
    })

    it.each([
      ['a 404 of another origin', 404, { other: true }],
      ['a success without content', 200, { iv: 'iv' }],
      ['a body that is not JSON', 200, null],
      ['a server error', 500, { code: 'internal_error' }],
    ])('should treat %s as an invalid response', async (_case, status, body) => {
      respondWith(status, body)

      expect(await readSecret('id', 'key')).toStrictEqual({ success: false, error: 'invalid_response' })
    })

    it('should report a network failure', async () => {
      fetchMock.mockRejectedValue(new TypeError('failed'))

      expect(await readSecret('id', 'key')).toStrictEqual({ success: false, error: 'network' })
    })
  })
})
