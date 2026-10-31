import { ToolCard } from '~/components/Landing/ToolCard'
import { useTranslation } from '~/context/TranslationContext'
import { LanguageSelector } from '~/components/Layout/LanguageSelector'

export function Landing() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-10 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{ t('landing.title') }</h1>
        <p className="mt-3 text-muted">{ t('landing.subtitle') }</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <ToolCard title={ t('landing.chat.title') } description={ t('landing.chat.description') } />
        <ToolCard title={ t('landing.secrets.title') } description={ t('landing.secrets.description') } />
      </section>

      <LanguageSelector />
    </main>
  )
}
