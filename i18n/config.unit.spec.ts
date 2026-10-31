import en from '~/i18n/locales/en.json'
import { DEFAULT_LOCALE, detectLocale, isLocale, LOCALES, Locale, Messages } from '~/i18n/config'
import { loadMessages } from '~/i18n/loadMessages'

describe('i18n', () => {
  describe('detectLocale', () => {
    it('should use the first supported language of the browser', () => {
      expect(detectLocale(['pt-BR', 'de-AT', 'en'])).toBe('de')
    })

    it('should fall back to the default locale', () => {
      expect(detectLocale(['ja', 'ko'])).toBe(DEFAULT_LOCALE)
      expect(detectLocale([])).toBe(DEFAULT_LOCALE)
    })
  })

  describe('isLocale', () => {
    it('should only accept supported locales', () => {
      expect(isLocale('it')).toBe(true)
      expect(isLocale('pt')).toBe(false)
      expect(isLocale(undefined)).toBe(false)
    })
  })

  describe.each(LOCALES)('messages of %s', (locale: Locale) => {
    let messages: Messages

    beforeAll(async () => {
      messages = await loadMessages(locale)
    })

    it('should have exactly the same keys as the reference locale', () => {
      expect(Object.keys(messages).sort()).toStrictEqual(Object.keys(en).sort())
    })

    it('should not have empty messages', () => {
      expect(Object.values(messages).filter((message) => message.trim() === '')).toStrictEqual([])
    })
  })
})
