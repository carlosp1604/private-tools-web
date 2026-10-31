import { useEffect, useRef, useState } from 'react'
import { deriveRoomKeys } from '~/crypto/chatCrypto'
import { openRoomConnection } from '~/services/chat/openRoomConnection'
import { ChatSession, ChatStatus } from '~/services/chat/ChatSession'

export interface ChatMessage {
  id: number
  mine: boolean
  text: string
}

export function useChat() {
  const sessionRef = useRef<ChatSession | null>(null)
  const nextMessageIdRef = useRef(0)
  const attemptRef = useRef(0)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [sessionCode, setSessionCode] = useState('')
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [undelivered, setUndelivered] = useState(false)

  const addMessage = (mine: boolean, text: string) => {
    const id = nextMessageIdRef.current

    nextMessageIdRef.current += 1
    setMessages((current) => [...current, { id, mine, text }])
  }

  const connect = async (code: string, password: string) => {
    const attempt = attemptRef.current

    setSessionCode(code)
    setStatus('connecting')

    const { roomId, authKey } = await deriveRoomKeys(code, password)

    if (attempt !== attemptRef.current) {
      return
    }

    sessionRef.current = openRoomConnection(roomId, authKey, {
      onStatus: setStatus,
      onMessage: (text) => addMessage(false, text),
      onUndelivered: () => setUndelivered(true),
    })
  }

  const send = async (text: string) => {
    setUndelivered(false)

    await sessionRef.current?.send(text)

    addMessage(true, text)
  }

  const leave = () => {
    attemptRef.current += 1
    sessionRef.current?.leave()
    sessionRef.current = null
    setStatus(null)
    setSessionCode('')
    setMessages([])
    setUndelivered(false)
  }

  const inConversation = status !== null

  useEffect(() => {
    if (!inConversation) {
      return
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [inConversation])

  return { status, sessionCode, messages, undelivered, connect, send, leave }
}
