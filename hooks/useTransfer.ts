import { useEffect, useRef, useState } from 'react'
import { BrowserPeer, createBrowserIdentity } from '~/services/transfer/BrowserPeer'
import { checkRoomAvailability, openTransferSocket, reserveRoom } from '~/services/transfer/TransferRoomService'
import { createCommitment, generateNonce, VerificationNames } from '~/crypto/transferVerification'
import { SignalMessage, TransferConnection, TransferRole, TransferStatus } from '~/services/transfer/TransferConnection'

export type TransferEndReason = 'room_not_found' | 'room_closed' | 'room_expired' | 'failed' | TransferFailure
type TransferFailure = 'unreachable' | 'compromised'

interface RoomNotice {
  type?: unknown
}

const CONNECTION_TIMEOUT_MS = 10_000

function isTransferFailure(status: TransferStatus): status is TransferFailure {
  return status === 'unreachable' || status === 'compromised'
}

export function useTransfer(initialCode?: string, expectedCommitment?: string) {
  const connectionRef = useRef<TransferConnection | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const [role, setRole] = useState<TransferRole | null>(null)
  const [status, setStatus] = useState<TransferStatus | null>(null)
  const [code, setCode] = useState('')
  const [commitment, setCommitment] = useState('')
  const [names, setNames] = useState<VerificationNames | null>(null)
  const [endReason, setEndReason] = useState<TransferEndReason | null>(null)

  const release = () => {
    const socket = socketRef.current

    socketRef.current = null
    connectionRef.current?.close()
    connectionRef.current = null
    socket?.close()
  }

  const finish = (reason: TransferEndReason | null) => {
    release()
    setRole(null)
    setStatus(null)
    setCode('')
    setCommitment('')
    setNames(null)
    setEndReason(reason)
  }

  const start = async (nextRole: TransferRole, roomCode: string, expectedCommitment: string | null): Promise<void> => {
    const identity = await createBrowserIdentity()
    const nonce = generateNonce()
    const socket = openTransferSocket(roomCode)
    const connectionTimeout = setTimeout(() => socket.close(), CONNECTION_TIMEOUT_MS)
    const signal = (message: SignalMessage) => socket.send(new TextEncoder().encode(JSON.stringify(message)))

    socketRef.current = socket

    const connection: TransferConnection = new TransferConnection(
      nextRole,
      { nonce, fingerprint: identity.fingerprint },
      expectedCommitment,
      signal,
      new BrowserPeer(nextRole, identity, {
        onCandidate: (candidate) => connection.handleCandidate(candidate),
        onControlOpen: () => connection.handleControlOpen(),
        onControlMessage: (message) => connection.handleControlMessage(message),
        onUnreachable: () => connection.handleUnreachable(),
      }),
      {
        onStatus: (nextStatus) => (isTransferFailure(nextStatus) ? finish(nextStatus) : setStatus(nextStatus)),
        onVerified: setNames,
      }
    )

    connectionRef.current = connection

    setCommitment(await createCommitment(nonce, identity.fingerprint))
    setCode(roomCode)
    setRole(nextRole)
    setEndReason(null)
    setStatus('waiting')

    socket.addEventListener('open', () => clearTimeout(connectionTimeout))
    socket.addEventListener('close', () => {
      clearTimeout(connectionTimeout)

      if (socketRef.current === socket) {
        finish('room_closed')
      }
    })
    socket.addEventListener('message', (event: MessageEvent<string | ArrayBuffer>) => {
      if (typeof event.data !== 'string') {
        connection.handleSignal(JSON.parse(new TextDecoder().decode(event.data)) as SignalMessage)

        return
      }

      const { type } = JSON.parse(event.data) as RoomNotice

      if (type === 'peer_joined') {
        connection.handlePeerJoined()
      } else if (type === 'room_closed' || type === 'room_expired') {
        finish(type)
      }
    })
  }

  const send = async () => {
    setEndReason(null)

    const result = await reserveRoom()

    if (result.success) {
      await start('sender', result.value, null)
    } else {
      setEndReason('failed')
    }
  }

  const receive = async (roomCode: string, expectedCommitment: string | null) => {
    setEndReason(null)

    const result = await checkRoomAvailability(roomCode)

    if (result.success) {
      await start('receiver', roomCode, expectedCommitment)
    } else {
      setEndReason(result.error === 'not_found' ? 'room_not_found' : 'failed')
    }
  }

  const leave = () => finish(null)

  const startedFromLinkRef = useRef(false)

  useEffect(() => {
    if (initialCode && !startedFromLinkRef.current) {
      startedFromLinkRef.current = true

      void receive(initialCode, expectedCommitment ?? null)
    }
  })

  useEffect(() => () => {
    const socket = socketRef.current

    socketRef.current = null
    connectionRef.current?.close()
    socket?.close()
  }, [])

  return { role, status, code, commitment, names, endReason, send, receive, leave }
}
