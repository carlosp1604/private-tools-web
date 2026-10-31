import { ReactNode, useEffect, useState } from 'react'
import { loadMessages } from '~/i18n/loadMessages'
import { TranslationProvider } from '~/context/TranslationContext'
import { detectLocale, Locale, Messages } from '~/i18n/config'

interface LoadedTranslation {
  locale: Locale
  messages: Messages
}

interface Props {
  children: ReactNode
}

/**
 * For pages opened from a shared link, which is the same in every language: the browser of the visitor decides
 */
export function BrowserTranslation({ children }: Props) {
  const [translation, setTranslation] = useState<LoadedTranslation | null>(null)

  useEffect(() => {
    const locale = detectLocale(navigator.languages)

    document.documentElement.lang = locale

    void loadMessages(locale).then((messages) => setTranslation({ locale, messages }))
  }, [])

  if (!translation) {
    return null
  }

  return <TranslationProvider { ...translation }>{ children }</TranslationProvider>
}
