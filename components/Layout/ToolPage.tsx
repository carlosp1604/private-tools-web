import Link from 'next/link'
import { ReactNode } from 'react'
import { useTranslation } from '~/context/TranslationContext'

interface Props {
  title: string
  description: string
  children: ReactNode
}

export function ToolPage({ title, description, children }: Props) {
  const { locale, t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-4 py-10">
      <Link href={ `/${locale}` } className="text-sm text-muted hover:text-foreground">{ t('nav.back') }</Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{ title }</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{ description }</p>
      </header>

      { children }
    </main>
  )
}
