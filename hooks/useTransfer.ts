import { useEffect, useRef, useState } from 'react'
import { createFileSink, FileTooLargeError } from '~/services/transfer/fileSinks'
import { FileDescription, FileExchange, FileExchangeStatus } from '~/services/transfer/FileExchange'
import { estimateRemainingSeconds, SpeedSample, updateSpeed } from '~/helpers/transferProgress'
import { BrowserPeer, createBrowserIdentity } from '~/services/transfer/BrowserPeer'
import { checkRoomAvailability, openTransferSocket, reserveRoom } from '~/services/transfer/TransferRoomService'
import { createCommitment, generateNonce, VerificationNames } from '~/crypto/transferVerification'
import { SignalMessage, TransferConnection, TransferRole, TransferStatus } from '~/services/transfer/TransferConnection'

export type TransferEndReason = 'room_not_found' | 'room_closed' | 'room_expired' | 'failed' | 'completed' | TransferFailure
type TransferFailure = 'unreachable' | 'compromised'

interface RoomNotice {
  type?: unknown
}

const CONNECTION_TIMEOUT_MS = 10_000
const ESTIMATE_INTERVAL_MS = 1_000
const RECONNECT_DELAY_MS = 2_000

export interface TransferProgress {
  bytes: number
  bytesPerSecond: number
  remainingSeconds: number | null
}

function isTransferFailure(status: TransferStatus): status is TransferFailure {
  return status === 'unreachable' || status === 'compromised'
}

export function useTransfer(initialCode?: string, expectedCommitment?: string) {
  const connectionRef = useRef<TransferConnection | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const exchangeRef = useRef<FileExchange | null>(null)
  const speedRef = useRef<SpeedSample | null>(null)
  const transferredBytesRef = useRef(0)
  const exchangeStatusRef = useRef<FileExchangeStatus>('idle')
  const outgoingFileRef = useRef<File | null>(null)
  const [role, setRole] = useState<TransferRole | null>(null)
  const [status, setStatus] = useState<TransferStatus | null>(null)
  const [code, setCode] = useState('')
  const [commitment, setCommitment] = useState('')
  const [names, setNames] = useState<VerificationNames | null>(null)
  const [endReason, setEndReason] = useState<TransferEndReason | null>(null)
  const [exchangeStatus, setExchangeStatus] = useState<FileExchangeStatus>('idle')
  const [incomingFile, setIncomingFile] = useState<FileDescription | null>(null)
  const [outgoingFile, setOutgoingFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<TransferProgress>({ bytes: 0, bytesPerSecond: 0, remainingSeconds: null })
  const [fileTooLarge, setFileTooLarge] = useState(false)

  const release = () => {
    const socket = socketRef.current

    const exchange = exchangeRef.current

    socketRef.current = null
    exchangeRef.current = null
    exchange?.abort()
    connectionRef.current?.close()
    connectionRef.current = null
    socket?.close()
  }

  const finish = (reason: TransferEndReason | null) => {
    const completed = exchangeStatusRef.current === 'completed'

    release()
    speedRef.current = null
    transferredBytesRef.current = 0
    exchangeStatusRef.current = 'idle'
    setExchangeStatus('idle')
    setIncomingFile(null)
    setOutgoingFile(null)
    setProgress({ bytes: 0, bytesPerSecond: 0, remainingSeconds: null })
    setFileTooLarge(false)
    setRole(null)
    setStatus(null)
    setCode('')
    setCommitment('')
    setNames(null)
    setEndReason(completed && reason ? 'completed' : reason)
  }

  const trackProgress = (bytes: number) => {
    transferredBytesRef.current = bytes
    setProgress((current) => ({ ...current, bytes }))
  }

  const start = async (nextRole: TransferRole, roomCode: string, expectedCommitment: string | null): Promise<void> => {
    const identity = await createBrowserIdentity()
    const nonce = generateNonce()
    const signal = (message: SignalMessage) => socketRef.current?.send(new TextEncoder().encode(JSON.stringify(message)))

    const peer = new BrowserPeer(nextRole, identity, {
      onCandidate: (candidate) => connection.handleCandidate(candidate),
      onControlOpen: () => connection.handleControlOpen(),
      onControlMessage: (message) => connection.handleControlMessage(message),
      onChunk: (chunk) => exchangeRef.current?.handleChunk(chunk),
      onUnreachable: () => connection.handleUnreachable(),
      onRestored: () => connection.handleRestored(),
      onChannelClosed: () => {
        if (connectionRef.current === connection) {
          finish('room_closed')
        }
      },
    })

    const connection: TransferConnection = new TransferConnection(
      nextRole,
      { nonce, fingerprint: identity.fingerprint },
      expectedCommitment,
      signal,
      peer,
      {
        onStatus: (nextStatus) => (isTransferFailure(nextStatus) ? finish(nextStatus) : setStatus(nextStatus)),
        onVerified: (verifiedNames) => {
          verified = true
          setNames(verifiedNames)

          exchangeRef.current = new FileExchange(nextRole, peer, {
            onStatus: (nextExchangeStatus) => {
              exchangeStatusRef.current = nextExchangeStatus
              setExchangeStatus(nextExchangeStatus)

              // During a release the exchange is already detached, so its own failure must not end the room again
              if (nextExchangeStatus === 'failed' && exchangeRef.current) {
                finish('failed')
              }
            },
            onOffer: setIncomingFile,
            onProgress: trackProgress,
          })
        },
        onMessage: (message) => exchangeRef.current?.handleMessage(message),
      }
    )

    connectionRef.current = connection

    setCommitment(await createCommitment(nonce, identity.fingerprint))
    setCode(roomCode)
    setRole(nextRole)
    setEndReason(null)
    setStatus('waiting')

    let peerSeen = false
    let verified = false

    /**
     * Phones drop the socket as soon as the page goes to the background, for instance to pick the file or to share
     * the code. Until the other side arrives that loses nothing, so the same identity simply connects again
     */
    const reconnect = async (lostSocket: WebSocket) => {
      const availability = await checkRoomAvailability(roomCode)

      if (socketRef.current !== lostSocket) {
        return
      }

      if (availability.success) {
        connectSocket()
      } else if (availability.error === 'not_found') {
        finish('room_expired')
      } else {
        setTimeout(() => void reconnect(lostSocket), RECONNECT_DELAY_MS)
      }
    }

    const connectSocket = () => {
      const socket = openTransferSocket(roomCode)
      const connectionTimeout = setTimeout(() => socket.close(), CONNECTION_TIMEOUT_MS)

      socketRef.current = socket

      socket.addEventListener('open', () => clearTimeout(connectionTimeout))
      socket.addEventListener('close', () => {
        clearTimeout(connectionTimeout)

        // Once the direct channel is verified, the room has done its job and that channel tells when the other side leaves.
        // Phones drop this socket just by opening the file picker, which must not end a healthy connection
        if (socketRef.current !== socket || verified) {
          return
        }

        if (peerSeen) {
          finish('room_closed')
        } else {
          void reconnect(socket)
        }
      })
      socket.addEventListener('message', (event: MessageEvent<string | ArrayBuffer>) => {
        if (typeof event.data !== 'string') {
          connection.handleSignal(JSON.parse(new TextDecoder().decode(event.data)) as SignalMessage)

          return
        }

        const { type } = JSON.parse(event.data) as RoomNotice

        if (type === 'peer_joined') {
          peerSeen = true
          connection.handlePeerJoined()
        } else if ((type === 'room_closed' || type === 'room_expired') && !verified) {
          finish(type)
        }
      })
    }

    connectSocket()
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

  const selectFile = (file: File) => {
    outgoingFileRef.current = file
    setOutgoingFile(file)
  }

  const confirmSend = () => {
    if (outgoingFileRef.current) {
      exchangeRef.current?.offer(outgoingFileRef.current, outgoingFileRef.current.name)
    }
  }

  const acceptFile = async () => {
    if (!incomingFile) {
      return
    }

    try {
      await exchangeRef.current?.accept(await createFileSink(incomingFile.name, incomingFile.size))
    } catch (error) {
      setFileTooLarge(error instanceof FileTooLargeError)
    }
  }

  const totalBytes = incomingFile?.size ?? outgoingFile?.size ?? 0

  // On a timer instead of on each acknowledgement, so the numbers stay readable and a stall shows up as a falling speed
  useEffect(() => {
    if (exchangeStatus !== 'transferring') {
      return
    }

    speedRef.current = updateSpeed(null, transferredBytesRef.current, performance.now())

    const interval = setInterval(() => {
      const bytes = transferredBytesRef.current
      const sample = updateSpeed(speedRef.current, bytes, performance.now())

      speedRef.current = sample

      setProgress({
        bytes,
        bytesPerSecond: sample.bytesPerSecond,
        remainingSeconds: estimateRemainingSeconds(totalBytes - bytes, sample.bytesPerSecond),
      })
    }, ESTIMATE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [exchangeStatus, totalBytes])

  const transferring = exchangeStatus === 'transferring' || exchangeStatus === 'verifying'

  useEffect(() => {
    if (!transferring) {
      return
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()

    window.addEventListener('beforeunload', warnBeforeLeaving)

    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [transferring])

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
    exchangeRef.current?.abort()
    connectionRef.current?.close()
    socket?.close()
  }, [])

  return {
    role,
    status,
    code,
    commitment,
    names,
    endReason,
    exchangeStatus,
    incomingFile,
    outgoingFile,
    progress,
    fileTooLarge,
    send,
    receive,
    leave,
    selectFile,
    confirmSend,
    acceptFile,
  }
}
