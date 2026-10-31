import { useEffect, useRef, useState } from 'react'
import { deriveRoomKeys } from '~/crypto/chatCrypto'
import { openRoomConnection } from '~/services/chat/openRoomConnection'
import { generateDisplayName } from '~/services/chat/generateDisplayName'
import { ChatSession, ChatStatus } from '~/services/chat/ChatSession'

export type ChatEntry =
  | { kind: 'message'; id: number; mine: boolean; author: string; text: string; sentAt: Date }
  | { kind: 'event'; id: number; event: 'joined' | 'left'; name: string }

type NewChatEntry =
  | { kind: 'message'; mine: boolean; author: string; text: string; sentAt: Date }
  | { kind: 'event'; event: 'joined' | 'left'; name: string }

export function useChat() {
  const sessionRef = useRef<ChatSession | null>(null)
  const nextEntryIdRef = useRef(0)
  const attemptRef = useRef(0)
  const peerNameRef = useRef<string | null>(null)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [sessionCode, setSessionCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [peerName, setPeerName] = useState<string | null>(null)
  const [entries, setEntries] = useState<Array<ChatEntry>>([])
  const [undelivered, setUndelivered] = useState(false)

  const addEntry = (entry: NewChatEntry) => {
    const id = nextEntryIdRef.current

    nextEntryIdRef.current += 1
    setEntries((current) => [...current, { ...entry, id }])
  }

  const connect = async (code: string, password: string) => {
    const attempt = attemptRef.current
    const name = generateDisplayName()

    setSessionCode(code)
    setDisplayName(name)
    setStatus('connecting')

    const { roomId, authKey } = await deriveRoomKeys(code, password)

    if (attempt !== attemptRef.current) {
      return
    }

    sessionRef.current = openRoomConnection(roomId, authKey, name, {
      onStatus: setStatus,
      onMessage: (text) => addEntry({ kind: 'message', mine: false, author: peerNameRef.current ?? '', text, sentAt: new Date() }),
      onUndelivered: () => setUndelivered(true),
      onPeerJoined: (peer) => {
        peerNameRef.current = peer
        setPeerName(peer)
        addEntry({ kind: 'event', event: 'joined', name: peer })
      },
      onPeerLeft: (peer) => {
        peerNameRef.current = null
        setPeerName(null)
        addEntry({ kind: 'event', event: 'left', name: peer })
      },
    })
  }

  const send = async (text: string) => {
    setUndelivered(false)

    await sessionRef.current?.send(text)

    addEntry({ kind: 'message', mine: true, author: displayName, text, sentAt: new Date() })
  }

  const leave = () => {
    attemptRef.current += 1
    sessionRef.current?.leave()
    sessionRef.current = null
    peerNameRef.current = null
    setStatus(null)
    setSessionCode('')
    setDisplayName('')
    setPeerName(null)
    setEntries([])
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

  // Going back to another page unmounts this hook without unloading the document, so the socket has to be closed here
  useEffect(() => () => {
    attemptRef.current += 1
    sessionRef.current?.leave()
  }, [])

  return { status, sessionCode, displayName, peerName, entries, undelivered, connect, send, leave }
}
