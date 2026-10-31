import Document, { Head, Html, Main, NextScript } from 'next/document'
import { DEFAULT_LOCALE, isLocale } from '~/i18n/config'

export default class AppDocument extends Document {
  override render() {
    const { locale } = this.props.__NEXT_DATA__.query

    return (
      <Html lang={ isLocale(locale) ? locale : DEFAULT_LOCALE }>
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
