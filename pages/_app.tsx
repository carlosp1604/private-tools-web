import '~/styles/globals.css'
import type { AppProps } from 'next/app'
import { LocalePageProps } from '~/helpers/localePaths'
import { TranslationProvider } from '~/context/TranslationContext'

export default function App({ Component, pageProps }: AppProps<Partial<LocalePageProps>>) {
  const { locale, messages } = pageProps

  if (!locale || !messages) {
    return <Component { ...pageProps } />
  }

  return (
    <TranslationProvider locale={ locale } messages={ messages }>
      <Component { ...pageProps } />
    </TranslationProvider>
  )
}
