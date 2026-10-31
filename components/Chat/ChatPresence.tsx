import { interpolate } from '~/helpers/interpolate'
import { ActiveChatStatus } from '~/hooks/useChat'
import { useTranslation } from '~/context/TranslationContext'

const STATUS_MESSAGES = {
  connecting: 'chat.status.connecting',
  waiting: 'chat.status.waiting',
  securing: 'chat.status.securing',
  ready: 'chat.status.securing',
} as const

interface DotProps {
  online: boolean
}

function PresenceDot({ online }: DotProps) {
  return <span aria-hidden="true" className={ `size-2 shrink-0 rounded-full ${online ? 'bg-online' : 'bg-muted'}` } />
}

interface Props {
  status: ActiveChatStatus
  displayName: string
  peerName: string | null
}

export function ChatPresence({ status, displayName, peerName }: Props) {
  const { t } = useTranslation()
  const peerOnline = status === 'ready' && peerName !== null

  return (
    <div role="status" className="flex min-w-0 flex-col gap-1 text-sm">
      <p className="flex items-center gap-2 text-muted">
        <PresenceDot online />
        <span className="truncate">{ interpolate(t('chat.youAre'), { name: displayName }) }</span>
      </p>
      <p className="flex items-center gap-2 text-foreground">
        <PresenceDot online={ peerOnline } />
        <span className="truncate">
          { peerOnline ? interpolate(t('chat.connectedWith'), { name: peerName }) : t(STATUS_MESSAGES[status]) }
        </span>
      </p>
    </div>
  )
}
