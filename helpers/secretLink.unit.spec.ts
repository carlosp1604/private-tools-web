import { buildSecretLink, parseLinkKey } from '~/helpers/secretLink'

describe('secretLink', () => {
  const linkKey = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8'

  it('should keep the key in the fragment, which never reaches the server', () => {
    const link = new URL(buildSecretLink('https://tools.example', 'secret-id', linkKey))

    expect(link.pathname).toBe('/s/secret-id')
    expect(link.search).toBe('')
    expect(link.hash).toBe(`#${linkKey}`)
  })

  it('should read the key from the fragment', () => {
    expect(parseLinkKey(`#${linkKey}`)).toHaveLength(32)
  })

  it.each(['', '#', '#short', `#${linkKey}a`, `#${linkKey.slice(0, -1)}+`])('should reject %s', (hash) => {
    expect(parseLinkKey(hash)).toBeNull()
  })
})
