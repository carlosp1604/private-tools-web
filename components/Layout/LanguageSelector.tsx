import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from '~/context/TranslationContext'
import { LOCALE_NAMES, LOCALES } from '~/i18n/config'

export function LanguageSelector() {
  const { locale: currentLocale, t } = useTranslation()
  const { asPath } = useRouter()

  return (
    <nav aria-label={ t('language.label') } className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
      { LOCALES.map((locale) => (
        <Link
          key={ locale }
          href={ asPath.replace(`/${currentLocale}`, `/${locale}`) }
          hrefLang={ locale }
          aria-current={ locale === currentLocale ? 'true' : undefined }
          className={ locale === currentLocale ? 'text-foreground' : 'text-muted hover:text-foreground' }
        >
          { LOCALE_NAMES[locale] }
        </Link>
      )) }
    </nav>
  )
}
