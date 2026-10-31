import { parseFingerprint } from '~/crypto/transferVerification'
import { PeerPort, TransferRole } from '~/services/transfer/TransferConnection'

const ICE_SERVERS = [{ urls: 'stun:stun.cloudflare.com:3478' }]
const CONTROL_CHANNEL = 'control'

export interface BrowserIdentity {
  certificate: RTCCertificate
  fingerprint: string
}

export interface BrowserPeerEvents {
  onCandidate(candidate: RTCIceCandidateInit): void
  onControlOpen(): void
  onControlMessage(message: string): void
  onUnreachable(): void
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

export class BrowserPeer implements PeerPort {
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
      if (this.connection.iceConnectionState === 'failed') {
        events.onUnreachable()
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

  public sendControl(message: string): void {
    this.controlChannel?.send(message)
  }

  public close(): void {
    this.connection.close()
  }

  private attachControlChannel(channel: RTCDataChannel): void {
    this.controlChannel = channel

    channel.addEventListener('open', () => this.events.onControlOpen())
    channel.addEventListener('message', (event: MessageEvent<string>) => this.events.onControlMessage(event.data))
  }

  private async addPendingCandidates(): Promise<void> {
    for (const candidate of this.pendingCandidates.splice(0)) {
      await this.connection.addIceCandidate(candidate)
    }
  }
}
