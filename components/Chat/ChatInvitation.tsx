import { Button } from '~/components/ui/Button'
import { useTranslation } from '~/context/TranslationContext'
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard'

interface Props {
  sessionCode: string
}

export function ChatInvitation({ sessionCode }: Props) {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs leading-5 text-muted">{ t('chat.invitation') }</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <code className="font-mono text-sm break-all text-foreground">{ sessionCode }</code>
        <Button variant="secondary" onClick={ () => void copy(sessionCode) }>{ t(copied ? 'common.copied' : 'common.copy') }</Button>
      </div>
    </div>
  )
}
