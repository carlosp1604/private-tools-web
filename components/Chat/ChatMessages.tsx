import { useEffect, useRef } from 'react'
import { ChatMessage } from '~/hooks/useChat'

interface Props {
  messages: ReadonlyArray<ChatMessage>
}

export function ChatMessages({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  return (
    <div
      role="log"
      aria-live="polite"
      className="flex h-[45dvh] min-h-48 flex-col gap-2 overflow-y-auto rounded-2xl border border-border p-3"
    >
      { messages.map(({ id, mine, text }) => (
        <p
          key={ id }
          className={ `max-w-[85%] rounded-xl px-3 py-2 text-sm leading-6 break-words whitespace-pre-wrap ${
            mine ? 'self-end bg-accent text-background' : 'self-start bg-surface text-foreground'
          }` }
        >
          { text }
        </p>
      )) }
      <div ref={ endRef } />
    </div>
  )
}
