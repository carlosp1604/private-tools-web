import { Bytes } from '~/crypto/base64Url'
import { concatBytes } from '~/crypto/keyDerivation'
import {
  ChatChannel,
  confirmationsMatch,
  decryptMessage,
  encryptMessage,
  establishChannel,
  EphemeralKeys,
  generateEphemeralKeys
} from '~/crypto/chatCrypto'

const PUBLIC_KEY_FRAME = 1
const CONFIRMATION_FRAME = 2
const MESSAGE_FRAME = 3

export const ROOM_FULL_CLOSE_CODE = 4001

export type ChatStatus = 'connecting' | 'waiting' | 'securing' | 'ready' | 'room_full' | 'compromised' | 'disconnected'

export interface ChatTransport {
  send(frame: Bytes): void
  close(): void
}

export interface ChatSessionListener {
  onStatus(status: ChatStatus): void
  onMessage(text: string): void
  onUndelivered(): void
}

/**
 * Client side of the conversation, independent from React and from the socket. The server only ever sees the
 * binary frames this class produces, and it cannot tell a public key from a message
 */
export class ChatSession {
  private status: ChatStatus = 'connecting'
  private keys: EphemeralKeys | null = null
  private channel: ChatChannel | null = null
  private peerConfirmation: Bytes | null = null
  private peerConfirmed = false
  private sendSequence = 0
  private receiveSequence = 0
  private pending: Promise<void> = Promise.resolve()
  private left = false

  constructor(
    private readonly transport: ChatTransport,
    private readonly authKey: Bytes,
    private readonly listener: ChatSessionListener
  ) {}

  public handleOpen(): void {
    this.setStatus('waiting')
  }

  public handleNotice(notice: string): void {
    const type = this.parseNoticeType(notice)

    if (type === 'peer_joined') {
      this.enqueue(() => this.startHandshake())
    }

    if (type === 'peer_left') {
      this.enqueue(() => {
        this.resetHandshake()
        this.setStatus('waiting')
      })
    }

    if (type === 'peer_unavailable') {
      this.listener.onUndelivered()
    }
  }

  public handleFrame(frame: Bytes): void {
    this.enqueue(() => this.processFrame(frame))
  }

  public handleClose(code: number): void {
    this.enqueue(() => {
      this.resetHandshake()

      if (this.status !== 'compromised') {
        this.setStatus(code === ROOM_FULL_CLOSE_CODE ? 'room_full' : 'disconnected')
      }
    })
  }

  public send(text: string): Promise<void> {
    const sent = this.pending.then(async () => {
      if (!this.channel || this.status !== 'ready') {
        throw new Error('The channel is not ready')
      }

      const ciphertext = await encryptMessage(text, this.channel.sendKey, this.sendSequence)

      this.sendSequence += 1
      this.sendFrame(MESSAGE_FRAME, ciphertext)
    })

    this.pending = sent.catch(() => undefined)

    return sent
  }

  public leave(): void {
    this.left = true
    this.transport.close()
  }

  private enqueue(task: () => void | Promise<void>): void {
    this.pending = this.pending.then(task).catch(() => this.abort())
  }

  private parseNoticeType(notice: string): unknown {
    try {
      return (JSON.parse(notice) as { type?: unknown }).type
    } catch {
      return null
    }
  }

  private async startHandshake(): Promise<void> {
    this.resetHandshake()
    this.setStatus('securing')

    this.keys = await generateEphemeralKeys()
    this.sendFrame(PUBLIC_KEY_FRAME, this.keys.publicKey)
  }

  private async processFrame(frame: Bytes): Promise<void> {
    const type = frame[0]
    const payload = frame.slice(1)

    if (type === PUBLIC_KEY_FRAME) {
      await this.receivePublicKey(payload)
    } else if (type === CONFIRMATION_FRAME) {
      this.peerConfirmation = payload
      this.verifyPeer()
    } else if (type === MESSAGE_FRAME) {
      await this.receiveMessage(payload)
    } else {
      throw new Error('Unknown frame')
    }
  }

  private async receivePublicKey(peerPublicKey: Bytes): Promise<void> {
    if (!this.keys) {
      throw new Error('Unexpected public key')
    }

    this.channel = await establishChannel(this.keys, peerPublicKey, this.authKey)
    this.sendFrame(CONFIRMATION_FRAME, this.channel.confirmation)
    this.verifyPeer()
  }

  private verifyPeer(): void {
    if (!this.channel || !this.peerConfirmation) {
      return
    }

    if (!confirmationsMatch(this.peerConfirmation, this.channel.expectedConfirmation)) {
      throw new Error('The other side could not prove its identity')
    }

    this.peerConfirmed = true
    this.setStatus('ready')
  }

  private async receiveMessage(ciphertext: Bytes): Promise<void> {
    if (!this.channel || !this.peerConfirmed) {
      throw new Error('Unexpected message')
    }

    const text = await decryptMessage(ciphertext, this.channel.receiveKey, this.receiveSequence)

    this.receiveSequence += 1
    this.listener.onMessage(text)
  }

  private sendFrame(type: number, payload: Bytes): void {
    this.transport.send(concatBytes(new Uint8Array([type]), payload))
  }

  private resetHandshake(): void {
    this.keys = null
    this.channel = null
    this.peerConfirmation = null
    this.peerConfirmed = false
    this.sendSequence = 0
    this.receiveSequence = 0
  }

  private abort(): void {
    this.resetHandshake()
    this.setStatus('compromised')
    this.transport.close()
  }

  private setStatus(status: ChatStatus): void {
    this.status = status

    // Whoever leaves has already moved on, so the close of the socket must not reach them as a lost connection
    if (!this.left) {
      this.listener.onStatus(status)
    }
  }
}
