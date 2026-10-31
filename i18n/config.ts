import type messages from '~/i18n/locales/en.json'

export const LOCALES = ['es', 'en', 'de', 'fr', 'it'] as const
export const DEFAULT_LOCALE = 'en'

export type Locale = (typeof LOCALES)[number]
export type Messages = typeof messages
export type MessageKey = keyof Messages

export const LOCALE_NAMES: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value)
}

export function detectLocale(languages: ReadonlyArray<string>): Locale {
  const detected = languages.map((language) => language.split('-')[0]?.toLowerCase()).find(isLocale)

  return detected ?? DEFAULT_LOCALE
}
