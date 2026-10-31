import { generateDisplayName } from '~/services/chat/generateDisplayName'

describe('generateDisplayName', () => {
  it('should combine a prefix and an animal', () => {
    expect(generateDisplayName()).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/)
  })

  it('should vary between calls', () => {
    expect(new Set(Array.from({ length: 40 }, generateDisplayName)).size).toBeGreaterThan(10)
  })
})
