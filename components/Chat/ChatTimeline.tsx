import { useEffect, useRef } from 'react'
import { ChatEntry } from '~/hooks/useChat'
import { interpolate } from '~/helpers/interpolate'
import { ChatBubble } from '~/components/Chat/ChatBubble'
import { useTranslation } from '~/context/TranslationContext'

interface Props {
  entries: ReadonlyArray<ChatEntry>
}

export function ChatTimeline({ entries }: Props) {
  const { t } = useTranslation()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [entries])

  return (
    <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-3 py-3">
      { entries.map((entry) => (entry.kind === 'message'
        ? <ChatBubble key={ entry.id } mine={ entry.mine } author={ entry.author } text={ entry.text } sentAt={ entry.sentAt } />
        : (
          <p key={ entry.id } className="self-center rounded-full bg-surface px-3 py-1 text-xs text-muted">
            { interpolate(t(entry.event === 'joined' ? 'chat.event.joined' : 'chat.event.left'), { name: entry.name }) }
          </p>
        ))) }
      <div ref={ endRef } />
    </div>
  )
}
