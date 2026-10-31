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
  public restarts = 0
  public readonly messages: Array<string> = []
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
      restart: () => {
        this.restarts += 1

        return Promise.resolve(sdpWith(this.advertisedFingerprint))
      },
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
      onMessage: (message) => this.messages.push(message),
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

  const connectVerified = async (relay?: Relay) => {
    const pair = connect(relay)

    await openControl(pair)
    await until(() => pair.sender.names !== null && pair.receiver.names !== null)

    return pair
  }

  it('should hand over the messages that follow the verification', async () => {
    const { sender, receiver } = await connectVerified()

    receiver.connection.handleControlMessage('after verification')

    await until(() => receiver.messages.length === 1)

    expect(sender.status).toBe('connected')
    expect(receiver.messages).toStrictEqual(['after verification'])
  })

  it('should negotiate a new path when the network fails after verifying', async () => {
    const { sender, receiver } = await connectVerified()

    sender.connection.handleUnreachable()
    receiver.connection.handleUnreachable()

    await until(() => sender.restarts === 1)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(sender.status).toBe('connected')
    expect(receiver.status).toBe('connected')

    sender.connection.handleRestored()
    receiver.connection.handleRestored()
  })

  it('should abort when a new path brings another certificate', async () => {
    let swap = false

    const replaceCertificate: Relay = (message) => (
      swap && message.type === 'offer' ? { type: 'offer', sdp: sdpWith('CC:CC') } : message
    )
    const { sender, receiver } = await connectVerified(replaceCertificate)

    swap = true
    sender.connection.handleUnreachable()

    await until(() => receiver.status === 'compromised')

    sender.connection.handleRestored()
  })

  it('should give up when the network does not come back', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] })

    const side = new Side('receiver', identity(receiverFingerprint), receiverFingerprint, () => undefined)

    side.connection['verified'] = true
    side.connection.handleUnreachable()

    await jest.advanceTimersByTimeAsync(30_000)

    expect(side.status).toBe('unreachable')

    jest.useRealTimers()
  })

  it('should report that a direct connection is not possible', async () => {
    const side = new Side('sender', identity(senderFingerprint), senderFingerprint, () => undefined)

    side.connection.handleUnreachable()

    await until(() => side.status === 'unreachable')
  })
})
