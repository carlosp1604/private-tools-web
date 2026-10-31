import Link from 'next/link'

interface Props {
  title: string
  description: string
  href?: string
}

export function ToolCard({ title, description, href }: Props) {
  const content = (
    <>
      <h2 className="text-lg font-medium text-foreground">{ title }</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{ description }</p>
    </>
  )

  if (href) {
    return (
      <Link href={ href } className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:bg-surface-hover">
        { content }
      </Link>
    )
  }

  return <article className="rounded-2xl border border-border bg-surface p-6">{ content }</article>
}
