interface Props {
  title: string
  description: string
}

export function ToolCard({ title, description }: Props) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-lg font-medium text-foreground">{ title }</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{ description }</p>
    </article>
  )
}
