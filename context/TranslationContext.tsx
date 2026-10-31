import { createContext, ReactNode, use, useMemo } from 'react'
import { Locale, MessageKey, Messages } from '~/i18n/config'

interface Translation {
  locale: Locale
  t: (key: MessageKey) => string
}

const TranslationContext = createContext<Translation | null>(null)

interface Props {
  locale: Locale
  messages: Messages
  children: ReactNode
}

export function TranslationProvider({ locale, messages, children }: Props) {
  const translation = useMemo(() => ({ locale, t: (key: MessageKey) => messages[key] }), [locale, messages])

  return <TranslationContext value={ translation }>{ children }</TranslationContext>
}

export function useTranslation(): Translation {
  const translation = use(TranslationContext)

  if (!translation) {
    throw new Error('useTranslation must be used inside a TranslationProvider')
  }

  return translation
}
