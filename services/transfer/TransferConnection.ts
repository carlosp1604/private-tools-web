import { Bytes, decodeBase64Url, encodeBase64Url } from '~/crypto/base64Url'
import { createCommitment, deriveVerificationNames, parseFingerprint, VerificationNames } from '~/crypto/transferVerification'

export type TransferRole = 'sender' | 'receiver'

const RECOVERY_TIMEOUT_MS = 30_000

export type TransferStatus = 'waiting' | 'connecting' | 'verifying' | 'connected' | 'unreachable' | 'compromised'

export type SignalMessage =
  | { type: 'commitment'; value: string }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }

export interface LocalIdentity {
  nonce: Bytes
  fingerprint: string
}

export interface PeerPort {
  createOffer(): Promise<string>
  acceptOffer(sdp: string): Promise<string>
  acceptAnswer(sdp: string): Promise<void>
  addCandidate(candidate: RTCIceCandidateInit): Promise<void>
  restart(): Promise<string>
  sendControl(message: string): void
  close(): void
}

export interface TransferConnectionListener {
  onStatus(status: TransferStatus): void
  onVerified(names: VerificationNames): void
  onMessage(message: string): void
}

/**
 * Brings two browsers from a shared room to a verified direct connection. The server only relays what is needed to
 * find each other, and the commitments stop it from replacing a certificate without changing the names on screen
 */
export class TransferConnection {
  private peerCommitment: string | null = null
  private peerFingerprint: string | null = null
  private negotiationStarted = false
  private verified = false
  private recoveryTimeout: ReturnType<typeof setTimeout> | null = null
  private pending: Promise<void> = Promise.resolve()

  constructor(
    private readonly role: TransferRole,
    private readonly identity: LocalIdentity,
    private readonly expectedPeerCommitment: string | null,
    private readonly signal: (message: SignalMessage) => void,
    private readonly peer: PeerPort,
    private readonly listener: TransferConnectionListener
  ) {}

  public handlePeerJoined(): void {
    this.enqueue(async () => {
      this.listener.onStatus('connecting')
      this.signal({ type: 'commitment', value: await createCommitment(this.identity.nonce, this.identity.fingerprint) })
    })
  }

  public handleSignal(message: SignalMessage): void {
    this.enqueue(() => this.processSignal(message))
  }

  public handleCandidate(candidate: RTCIceCandidateInit): void {
    this.signal({ type: 'candidate', candidate })
  }

  public handleControlOpen(): void {
    this.listener.onStatus('verifying')
    this.peer.sendControl(encodeBase64Url(this.identity.nonce))
  }

  public handleControlMessage(message: string): void {
    this.enqueue(() => (this.verified ? this.listener.onMessage(message) : this.verifyPeer(message)))
  }

  /**
   * A network change breaks the path, not the session. Once verified, a new path is negotiated while the channel
   * stays alive, and only if that takes too long is the connection given up
   */
  public handleUnreachable(): void {
    this.enqueue(async () => {
      if (!this.verified) {
        this.listener.onStatus('unreachable')

        return
      }

      this.recoveryTimeout ??= setTimeout(() => this.listener.onStatus('unreachable'), RECOVERY_TIMEOUT_MS)

      if (this.role === 'sender') {
        this.signal({ type: 'offer', sdp: await this.peer.restart() })
      }
    })
  }

  public handleRestored(): void {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout)
      this.recoveryTimeout = null
    }
  }

  public close(): void {
    this.handleRestored()
    this.peer.close()
  }

  private enqueue(task: () => void | Promise<void>): void {
    this.pending = this.pending.then(task).catch(() => this.abort())
  }

  private async processSignal(message: SignalMessage): Promise<void> {
    if (message.type === 'commitment') {
      await this.receiveCommitment(message.value)
    } else if (message.type === 'offer') {
      await this.receiveOffer(message.sdp)
    } else if (message.type === 'answer') {
      this.rememberPeerFingerprint(message.sdp)
      await this.peer.acceptAnswer(message.sdp)
    } else {
      await this.peer.addCandidate(message.candidate)
    }
  }

  private async receiveCommitment(commitment: string): Promise<void> {
    if (this.expectedPeerCommitment && this.expectedPeerCommitment !== commitment) {
      throw new Error('The commitment does not match the one in the link')
    }

    this.peerCommitment = commitment

    if (this.role === 'sender' && !this.negotiationStarted) {
      this.negotiationStarted = true
      this.signal({ type: 'offer', sdp: await this.peer.createOffer() })
    }
  }

  private async receiveOffer(sdp: string): Promise<void> {
    if (!this.peerCommitment) {
      throw new Error('Unexpected offer')
    }

    this.rememberPeerFingerprint(sdp)
    this.signal({ type: 'answer', sdp: await this.peer.acceptOffer(sdp) })
  }

  private rememberPeerFingerprint(sdp: string): void {
    const fingerprint = parseFingerprint(sdp)

    if (!fingerprint || (this.verified && fingerprint !== this.peerFingerprint)) {
      throw new Error('The description does not have the expected fingerprint')
    }

    this.peerFingerprint = fingerprint
  }

  private async verifyPeer(encodedNonce: string): Promise<void> {
    if (!this.peerCommitment || !this.peerFingerprint) {
      throw new Error('Unexpected verification message')
    }

    const peerNonce = decodeBase64Url(encodedNonce)

    if ((await createCommitment(peerNonce, this.peerFingerprint)) !== this.peerCommitment) {
      throw new Error('The certificate does not match the commitment')
    }

    const { nonce, fingerprint } = this.identity
    const names = this.role === 'sender'
      ? await deriveVerificationNames(nonce, peerNonce, fingerprint, this.peerFingerprint)
      : await deriveVerificationNames(peerNonce, nonce, this.peerFingerprint, fingerprint)

    this.verified = true
    this.listener.onStatus('connected')
    this.listener.onVerified(names)
  }

  private abort(): void {
    this.listener.onStatus('compromised')
    this.peer.close()
  }
}
