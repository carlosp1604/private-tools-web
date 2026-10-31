import { parseFingerprint } from '~/crypto/transferVerification'
import { Bytes } from '~/crypto/base64Url'
import { FileChannel } from '~/services/transfer/FileExchange'
import { PeerPort, TransferRole } from '~/services/transfer/TransferConnection'

const ICE_SERVERS = [{ urls: 'stun:stun.cloudflare.com:3478' }]
const CONTROL_CHANNEL = 'control'
const BUFFER_HIGH_BYTES = 1024 * 1024
const BUFFER_LOW_BYTES = 256 * 1024

export interface BrowserIdentity {
  certificate: RTCCertificate
  fingerprint: string
}

export interface BrowserPeerEvents {
  onCandidate(candidate: RTCIceCandidateInit): void
  onControlOpen(): void
  onControlMessage(message: string): void
  onChunk(chunk: Bytes): void
  onUnreachable(): void
  onRestored(): void
}

/**
 * The certificate has to exist before the connection, because its fingerprint goes in the commitment and in the link
 */
export async function createBrowserIdentity(): Promise<BrowserIdentity> {
  const certificate = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' } as AlgorithmIdentifier)
  const connection = new RTCPeerConnection({ certificates: [certificate] })

  connection.createDataChannel(CONTROL_CHANNEL)

  const { sdp = '' } = await connection.createOffer()

  connection.close()

  const fingerprint = parseFingerprint(sdp)

  if (!fingerprint) {
    throw new Error('The browser did not expose its certificate fingerprint')
  }

  return { certificate, fingerprint }
}

export class BrowserPeer implements PeerPort, FileChannel {
  private readonly connection: RTCPeerConnection
  private controlChannel: RTCDataChannel | null = null
  private readonly pendingCandidates: Array<RTCIceCandidateInit> = []

  constructor(role: TransferRole, identity: BrowserIdentity, private readonly events: BrowserPeerEvents) {
    this.connection = new RTCPeerConnection({ iceServers: ICE_SERVERS, certificates: [identity.certificate] })

    this.connection.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate) {
        events.onCandidate(candidate.toJSON())
      }
    })

    this.connection.addEventListener('iceconnectionstatechange', () => {
      const state = this.connection.iceConnectionState

      if (state === 'failed') {
        events.onUnreachable()
      } else if (state === 'connected' || state === 'completed') {
        events.onRestored()
      }
    })

    if (role === 'sender') {
      this.attachControlChannel(this.connection.createDataChannel(CONTROL_CHANNEL))
    } else {
      this.connection.addEventListener('datachannel', ({ channel }) => this.attachControlChannel(channel))
    }
  }

  public async createOffer(): Promise<string> {
    const offer = await this.connection.createOffer()

    await this.connection.setLocalDescription(offer)

    return offer.sdp ?? ''
  }

  public async acceptOffer(sdp: string): Promise<string> {
    await this.connection.setRemoteDescription({ type: 'offer', sdp })
    await this.addPendingCandidates()

    const answer = await this.connection.createAnswer()

    await this.connection.setLocalDescription(answer)

    return answer.sdp ?? ''
  }

  public async acceptAnswer(sdp: string): Promise<void> {
    await this.connection.setRemoteDescription({ type: 'answer', sdp })
    await this.addPendingCandidates()
  }

  public async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.connection.remoteDescription) {
      await this.connection.addIceCandidate(candidate)
    } else {
      this.pendingCandidates.push(candidate)
    }
  }

  public async restart(): Promise<string> {
    const offer = await this.connection.createOffer({ iceRestart: true })

    await this.connection.setLocalDescription(offer)

    return offer.sdp ?? ''
  }

  public sendControl(message: string): void {
    this.controlChannel?.send(message)
  }

  public sendMessage(message: string): void {
    this.sendControl(message)
  }

  public sendChunk(chunk: Bytes): void {
    this.controlChannel?.send(chunk)
  }

  public waitForDrain(): Promise<void> {
    const channel = this.controlChannel

    if (!channel || channel.bufferedAmount < BUFFER_HIGH_BYTES) {
      return Promise.resolve()
    }

    return new Promise((resolve) => channel.addEventListener('bufferedamountlow', () => resolve(), { once: true }))
  }

  public close(): void {
    this.connection.close()
  }

  private attachControlChannel(channel: RTCDataChannel): void {
    this.controlChannel = channel

    channel.binaryType = 'arraybuffer'
    channel.bufferedAmountLowThreshold = BUFFER_LOW_BYTES

    channel.addEventListener('open', () => this.events.onControlOpen())
    channel.addEventListener('message', (event: MessageEvent<string | ArrayBuffer>) => {
      if (typeof event.data === 'string') {
        this.events.onControlMessage(event.data)
      } else {
        this.events.onChunk(new Uint8Array(event.data))
      }
    })
  }

  private async addPendingCandidates(): Promise<void> {
    for (const candidate of this.pendingCandidates.splice(0)) {
      await this.connection.addIceCandidate(candidate)
    }
  }
}
