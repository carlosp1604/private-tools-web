import { ANIMALS, generateDisplayName, PREFIXES } from '~/services/chat/generateDisplayName'

describe('generateDisplayName', () => {
  it('should combine a prefix, an animal and a two digit number', () => {
    expect(generateDisplayName()).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+[1-9]\d$/)
  })

  it('should offer millions of combinations', () => {
    expect(PREFIXES.length * ANIMALS.length * 90).toBeGreaterThan(3_000_000)
  })

  it('should keep every word in a single capitalized form', () => {
    expect([...PREFIXES, ...ANIMALS].filter((word) => !/^[A-Z][a-z]+$/.test(word))).toStrictEqual([])
  })

  it('should not repeat words, which would make some names more likely', () => {
    expect(new Set(PREFIXES).size).toBe(PREFIXES.length)
    expect(new Set(ANIMALS).size).toBe(ANIMALS.length)
  })

  it('should almost never repeat a name', () => {
    expect(new Set(Array.from({ length: 1_000 }, generateDisplayName)).size).toBeGreaterThan(990)
  })
})
