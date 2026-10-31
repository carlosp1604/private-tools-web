import { GetStaticPaths, GetStaticProps } from 'next'
import { isLocale, Locale, LOCALES, Messages } from '~/i18n/config'
import { loadMessages } from '~/i18n/loadMessages'

export interface LocalePageProps {
  locale: Locale
  messages: Messages
}

export const getLocalePaths: GetStaticPaths = () => ({
  paths: LOCALES.map((locale) => ({ params: { locale } })),
  fallback: false,
})

export const getLocaleProps: GetStaticProps<LocalePageProps> = async ({ params }) => {
  const locale = params?.locale

  if (!isLocale(locale)) {
    return { notFound: true }
  }

  return { props: { locale, messages: await loadMessages(locale) } }
}
