import { generateNonce, createCommitment } from '~/crypto/transferVerification'
import {
  LocalIdentity,
  PeerPort,
  SignalMessage,
  TransferConnection,
  TransferRole,
  TransferStatus
} from '~/services/transfer/TransferConnection'

const sdpWith = (fingerprint: string) => `v=0\r\na=fingerprint:sha-256 ${fingerprint}\r\n`

class Side {
  public readonly statuses: Array<TransferStatus> = []
  public names: { sender: string; receiver: string } | null = null
  public closed = false
  public connection!: TransferConnection
  public other!: Side

  constructor(
    public readonly role: TransferRole,
    public readonly identity: LocalIdentity,
    private readonly advertisedFingerprint: string,
    private readonly forward: (message: SignalMessage) => void,
    expectedPeerCommitment: string | null = null
  ) {
    const peer: PeerPort = {
      createOffer: () => Promise.resolve(sdpWith(this.advertisedFingerprint)),
      acceptOffer: () => Promise.resolve(sdpWith(this.advertisedFingerprint)),
      acceptAnswer: () => Promise.resolve(),
      addCandidate: () => Promise.resolve(),
      sendControl: (message) => this.other.connection.handleControlMessage(message),
      close: () => {
        this.closed = true
      },
    }

    this.connection = new TransferConnection(role, identity, expectedPeerCommitment, forward, peer, {
      onStatus: (status) => this.statuses.push(status),
      onVerified: (names) => {
        this.names = names
      },
    })
  }

  public get status(): TransferStatus | undefined {
    return this.statuses.at(-1)
  }
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000

  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Condition was not met in time')
    }

    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('TransferConnection', () => {
  const senderFingerprint = 'AA:AA'
  const receiverFingerprint = 'BB:BB'

  const identity = (fingerprint: string): LocalIdentity => ({ nonce: generateNonce(), fingerprint: `SHA-256 ${fingerprint}` })

  type Relay = (message: SignalMessage) => SignalMessage

  const connect = (
    relay: Relay = (message) => message,
    expectedCommitment: string | null = null,
    senderIdentity = identity(senderFingerprint)
  ) => {
    const sender: Side = new Side(
      'sender',
      senderIdentity,
      senderFingerprint,
      (message) => receiver.connection.handleSignal(relay(message))
    )
    const receiver: Side = new Side(
      'receiver',
      identity(receiverFingerprint),
      receiverFingerprint,
      (message) => sender.connection.handleSignal(relay(message)),
      expectedCommitment
    )

    sender.other = receiver
    receiver.other = sender

    sender.connection.handlePeerJoined()
    receiver.connection.handlePeerJoined()

    return { sender, receiver }
  }

  const openControl = async ({ sender, receiver }: { sender: Side; receiver: Side }) => {
    await until(() => sender.status === 'connecting' && receiver.status === 'connecting')
    await new Promise((resolve) => setTimeout(resolve, 20))

    sender.connection.handleControlOpen()
    receiver.connection.handleControlOpen()
  }

  it('should connect both sides and show them the same names', async () => {
    const pair = connect()

    await openControl(pair)
    await until(() => pair.sender.names !== null && pair.receiver.names !== null)

    expect(pair.sender.status).toBe('connected')
    expect(pair.receiver.status).toBe('connected')
    expect(pair.sender.names).toStrictEqual(pair.receiver.names)
  })

  it('should accept a sender that matches the commitment in the link', async () => {
    const senderIdentity = identity(senderFingerprint)
    const commitment = await createCommitment(senderIdentity.nonce, senderIdentity.fingerprint)
    const pair = connect((message) => message, commitment, senderIdentity)

    await openControl(pair)
    await until(() => pair.receiver.status === 'connected')
  })

  it('should abort when the commitment does not match the link', async () => {
    const pair = connect((message) => message, 'a'.repeat(43))

    await until(() => pair.receiver.status === 'compromised')

    expect(pair.receiver.closed).toBe(true)
  })

  it('should abort when the server replaces a certificate', async () => {
    const replaceCertificate: Relay = (message) => (message.type === 'offer' ? { type: 'offer', sdp: sdpWith('CC:CC') } : message)
    const pair = connect(replaceCertificate)

    await openControl(pair)
    await until(() => pair.receiver.status === 'compromised')

    expect(pair.receiver.names).toBeNull()
  })

  it('should abort when a description has no certificate', async () => {
    const removeCertificate: Relay = (message) => (message.type === 'offer' ? { type: 'offer', sdp: 'v=0\r\n' } : message)
    const pair = connect(removeCertificate)

    await until(() => pair.receiver.status === 'compromised')
  })

  it('should report that a direct connection is not possible', () => {
    const side = new Side('sender', identity(senderFingerprint), senderFingerprint, () => undefined)

    side.connection.handleUnreachable()

    expect(side.status).toBe('unreachable')
  })
})
