import { useChat } from '~/hooks/useChat'
import { ToolPage } from '~/components/Layout/ToolPage'
import { ChatRoom } from '~/components/Chat/ChatRoom'
import { ChatJoinForm } from '~/components/Chat/ChatJoinForm'
import { useTranslation } from '~/context/TranslationContext'

export function Chat() {
  const { t } = useTranslation()
  const { status, sessionCode, messages, undelivered, connect, send, leave } = useChat()

  return (
    <ToolPage title={ t('landing.chat.title') } description={ t('chat.description') }>
      { status === null
        ? <ChatJoinForm onJoin={ (sessionCode, password) => void connect(sessionCode, password) } />
        : (
          <ChatRoom
            status={ status }
            sessionCode={ sessionCode }
            messages={ messages }
            undelivered={ undelivered }
            onSend={ (text) => void send(text) }
            onLeave={ leave }
          />
        ) }
    </ToolPage>
  )
}
