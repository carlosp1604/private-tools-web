import type { Locale, Messages } from '~/i18n/config'

export async function loadMessages(locale: Locale): Promise<Messages> {
  const messages = await import(`~/i18n/locales/${locale}.json`) as { default: Messages }

  return messages.default
}
