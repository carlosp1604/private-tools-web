import { Button } from '~/components/ui/Button'
import { ChatMessage } from '~/hooks/useChat'
import { ChatStatus } from '~/services/chat/ChatSession'
import { ChatInvitation } from '~/components/Chat/ChatInvitation'
import { ChatComposer } from '~/components/Chat/ChatComposer'
import { ChatMessages } from '~/components/Chat/ChatMessages'
import { useTranslation } from '~/context/TranslationContext'

const STATUS_MESSAGES = {
  connecting: 'chat.status.connecting',
  waiting: 'chat.status.waiting',
  securing: 'chat.status.securing',
  ready: 'chat.status.ready',
  room_full: 'chat.status.roomFull',
  compromised: 'chat.status.compromised',
  disconnected: 'chat.status.disconnected',
} as const

interface Props {
  status: ChatStatus
  sessionCode: string
  messages: ReadonlyArray<ChatMessage>
  undelivered: boolean
  onSend: (text: string) => void
  onLeave: () => void
}

export function ChatRoom({ status, sessionCode, messages, undelivered, onSend, onLeave }: Props) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-sm text-foreground">{ t(STATUS_MESSAGES[status]) }</p>
        <Button variant="secondary" onClick={ onLeave }>{ t('chat.leave') }</Button>
      </div>

      { status === 'waiting' && <ChatInvitation sessionCode={ sessionCode } /> }

      <p className="rounded-xl border border-border px-3 py-2 text-xs leading-5 text-muted">{ t('chat.reloadWarning') }</p>

      <ChatMessages messages={ messages } />

      { undelivered && <p role="alert" className="text-sm text-foreground">{ t('chat.undelivered') }</p> }

      <ChatComposer disabled={ status !== 'ready' } onSend={ onSend } />
    </section>
  )
}
