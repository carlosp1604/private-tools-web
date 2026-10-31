import Link from 'next/link'
import { Button } from '~/components/ui/Button'
import { ChatEntry } from '~/hooks/useChat'
import { ChatStatus } from '~/services/chat/ChatSession'
import { ChatComposer } from '~/components/Chat/ChatComposer'
import { ChatPresence } from '~/components/Chat/ChatPresence'
import { ChatTimeline } from '~/components/Chat/ChatTimeline'
import { ChatInvitation } from '~/components/Chat/ChatInvitation'
import { useTranslation } from '~/context/TranslationContext'

interface Props {
  status: ChatStatus
  sessionCode: string
  displayName: string
  peerName: string | null
  entries: ReadonlyArray<ChatEntry>
  undelivered: boolean
  onSend: (text: string) => void
  onLeave: () => void
}

export function ChatRoom({ status, sessionCode, displayName, peerName, entries, undelivered, onSend, onLeave }: Props) {
  const { locale, t } = useTranslation()

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <Link href={ `/${locale}` } className="text-sm text-muted hover:text-foreground">{ t('nav.back') }</Link>
        <Button variant="secondary" onClick={ onLeave }>{ t('chat.leave') }</Button>
      </header>

      <ChatPresence status={ status } displayName={ displayName } peerName={ peerName } />

      { status === 'waiting' && <ChatInvitation sessionCode={ sessionCode } /> }

      <p className="rounded-lg bg-border px-3 py-2 text-xs leading-5 text-foreground">{ t('chat.reloadWarning') }</p>

      <ChatTimeline entries={ entries } />

      { undelivered && <p role="alert" className="text-sm text-foreground">{ t('chat.undelivered') }</p> }

      <ChatComposer disabled={ status !== 'ready' || peerName === null } onSend={ onSend } />

      <p className="rounded-lg bg-surface px-3 py-1.5 text-center text-xs text-muted">{ t('chat.encrypted') }</p>
    </main>
  )
}
