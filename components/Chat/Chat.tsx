import { useChat } from '~/hooks/useChat'
import { ChatRoom } from '~/components/Chat/ChatRoom'
import { ToolPage } from '~/components/Layout/ToolPage'
import { ChatJoinForm } from '~/components/Chat/ChatJoinForm'
import { useTranslation } from '~/context/TranslationContext'

export function Chat() {
  const { t } = useTranslation()
  const { status, sessionCode, displayName, peerName, entries, undelivered, connect, send, leave } = useChat()

  if (status === null) {
    return (
      <ToolPage title={ t('landing.chat.title') } description={ t('chat.description') }>
        <ChatJoinForm onJoin={ (code, password) => void connect(code, password) } />
      </ToolPage>
    )
  }

  return (
    <ChatRoom
      status={ status }
      sessionCode={ sessionCode }
      displayName={ displayName }
      peerName={ peerName }
      entries={ entries }
      undelivered={ undelivered }
      onSend={ (text) => void send(text) }
      onLeave={ leave }
    />
  )
}
