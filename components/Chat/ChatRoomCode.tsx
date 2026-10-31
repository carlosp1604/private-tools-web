import { Button } from '~/components/ui/Button'
import { useTranslation } from '~/context/TranslationContext'
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard'

interface Props {
  sessionCode: string
}

export function ChatRoomCode({ sessionCode }: Props) {
  const { t } = useTranslation()
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 flex-col text-sm">
        <span className="text-xs text-muted">{ t('chat.roomCode') }</span>
        <code className="font-mono break-all text-foreground">{ sessionCode }</code>
      </p>
      <Button variant="secondary" onClick={ () => void copy(sessionCode) }>{ t(copied ? 'common.copied' : 'common.copy') }</Button>
    </div>
  )
}
