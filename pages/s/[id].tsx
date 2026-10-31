import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { loadMessages } from '~/i18n/loadMessages'
import { ReadSecret } from '~/components/Secrets/ReadSecret'
import { TranslationProvider } from '~/context/TranslationContext'
import { detectLocale, Locale, Messages } from '~/i18n/config'

interface LoadedTranslation {
  locale: Locale
  messages: Messages
}

// The link is the same for every language, so the reader's browser decides which one to show
export default function ReadSecretPage() {
  const { isReady, query } = useRouter()
  const [translation, setTranslation] = useState<LoadedTranslation | null>(null)

  useEffect(() => {
    const locale = detectLocale(navigator.languages)

    document.documentElement.lang = locale

    void loadMessages(locale).then((messages) => setTranslation({ locale, messages }))
  }, [])

  if (!isReady || !translation || typeof query.id !== 'string') {
    return null
  }

  return (
    <TranslationProvider { ...translation }>
      <ReadSecret id={ query.id } />
    </TranslationProvider>
  )
}
