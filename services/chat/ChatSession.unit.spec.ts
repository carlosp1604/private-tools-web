import { Bytes, decodeBase64Url } from '~/crypto/base64Url'
import { generateEphemeralKeys } from '~/crypto/chatCrypto'
import { concatBytes } from '~/crypto/keyDerivation'
import { ChatSession, ChatStatus, ROOM_FULL_CLOSE_CODE } from '~/services/chat/ChatSession'

const PEER_JOINED = JSON.stringify({ type: 'peer_joined' })
const PEER_LEFT = JSON.stringify({ type: 'peer_left' })
const PEER_UNAVAILABLE = JSON.stringify({ type: 'peer_unavailable' })

const PUBLIC_KEY_FRAME = 1

type FrameFilter = (frame: Bytes) => Bytes | Promise<Bytes>

class Participant {
  public readonly statuses: Array<ChatStatus> = []
  public readonly messages: Array<string> = []
  public readonly joined: Array<string> = []
  public readonly left: Array<string> = []
  public undelivered = 0
  public closed = false
  public session: ChatSession

  constructor(authKey: Bytes, deliver: (frame: Bytes) => void, displayName = 'TurboMantis') {
    this.session = new ChatSession(
      {
        send: deliver,
        close: () => {
          this.closed = true
        },
      },
      authKey,
      displayName,
      {
        onStatus: (status) => this.statuses.push(status),
        onMessage: (text) => this.messages.push(text),
        onUndelivered: () => {
          this.undelivered += 1
        },
        onPeerJoined: (name) => this.joined.push(name),
        onPeerLeft: (name) => this.left.push(name),
      }
    )
  }

  public get status(): ChatStatus | undefined {
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

describe('ChatSession', () => {
  const authKey = decodeBase64Url('c6okGINDksH1GaN8SyJi0PJ-Xx5nxaJJG7HOhEW8ulg')

  // Stands for the server: it forwards frames in order and can alter them, like a malicious relay would
  const connectPair = (filter: FrameFilter = (frame) => frame, secondAuthKey: Bytes = authKey) => {
    const relay = (getTarget: () => Participant) => (frame: Bytes) => {
      void Promise.resolve(filter(frame)).then((forwarded) => getTarget().session.handleFrame(forwarded))
    }

    const first: Participant = new Participant(authKey, relay(() => second), 'HyperOtter')
    const second: Participant = new Participant(secondAuthKey, relay(() => first), 'TurboMantis')

    first.session.handleOpen()
    second.session.handleOpen()
    first.session.handleNotice(PEER_JOINED)
    second.session.handleNotice(PEER_JOINED)

    return { first, second }
  }

  const connectReadyPair = async () => {
    const pair = connectPair()

    await until(() => pair.first.joined.length === 1 && pair.second.joined.length === 1)

    return pair
  }

  it('should wait alone until someone else joins', () => {
    const participant = new Participant(authKey, () => undefined)

    participant.session.handleOpen()

    expect(participant.status).toBe('waiting')
  })

  it('should secure the channel when both sides meet', async () => {
    const { first, second } = await connectReadyPair()

    expect(first.statuses).toStrictEqual(['waiting', 'securing', 'ready'])
    expect(second.statuses).toStrictEqual(['waiting', 'securing', 'ready'])
  })

  it('should exchange messages in order in both directions', async () => {
    const { first, second } = await connectReadyPair()

    await first.session.send('uno')
    await first.session.send('dos')
    await second.session.send('tres')

    await until(() => second.messages.length === 2 && first.messages.length === 1)

    expect(second.messages).toStrictEqual(['uno', 'dos'])
    expect(first.messages).toStrictEqual(['tres'])
  })

  it('should tell each side the name of the other one', async () => {
    const { first, second } = await connectReadyPair()

    expect(first.joined).toStrictEqual(['TurboMantis'])
    expect(second.joined).toStrictEqual(['HyperOtter'])
  })

  it('should never put the display name in a frame without encrypting it', async () => {
    const frames: Array<Bytes> = []
    const { first, second } = connectPair((frame) => {
      frames.push(frame)

      return frame
    })

    await until(() => first.joined.length === 1 && second.joined.length === 1)

    expect(new TextDecoder('latin1').decode(concatBytes(...frames))).not.toContain('Mantis')
  })

  it('should report who left', async () => {
    const { first } = await connectReadyPair()

    first.session.handleNotice(PEER_LEFT)

    await until(() => first.left.length === 1)

    expect(first.left).toStrictEqual(['TurboMantis'])
  })

  it('should not report a departure when nobody had finished joining', async () => {
    const participant = new Participant(authKey, () => undefined)

    participant.session.handleOpen()
    participant.session.handleNotice(PEER_LEFT)
    await until(() => participant.statuses.length === 2)

    expect(participant.left).toStrictEqual([])
  })

  it('should refuse to send before the channel is ready', async () => {
    const participant = new Participant(authKey, () => undefined)

    participant.session.handleOpen()

    await expect(participant.session.send('hola')).rejects.toThrow()
  })

  it('should never put the text in a frame', async () => {
    const frames: Array<Bytes> = []
    const { first, second } = connectPair((frame) => {
      frames.push(frame)

      return frame
    })

    await until(() => first.joined.length === 1 && second.joined.length === 1)
    await first.session.send('texto muy secreto')
    await until(() => second.messages.length === 1)

    expect(new TextDecoder('latin1').decode(concatBytes(...frames))).not.toContain('secreto')
  })

  it('should detect a relay that swaps the public keys', async () => {
    const attacker = await generateEphemeralKeys()

    const swapKeys: FrameFilter = (frame) => (frame[0] === PUBLIC_KEY_FRAME
      ? concatBytes(new Uint8Array([PUBLIC_KEY_FRAME]), attacker.publicKey)
      : frame)

    const { first, second } = connectPair(swapKeys)

    await until(() => first.status === 'compromised' && second.status === 'compromised')

    expect(first.closed).toBe(true)
    expect(second.closed).toBe(true)
    expect(first.statuses).not.toContain('ready')
  })

  it('should detect a peer that does not know the password', async () => {
    const { first, second } = connectPair((frame) => frame, new Uint8Array(32))

    await until(() => first.status === 'compromised' && second.status === 'compromised')

    expect(first.statuses).not.toContain('ready')
  })

  it('should abort when a message is tampered with', async () => {
    let tamper = false

    const { first, second } = connectPair((frame) => {
      if (tamper) {
        const altered = frame.slice()

        altered[altered.length - 1] = (altered.at(-1) ?? 0) ^ 1

        return altered
      }

      return frame
    })

    await until(() => first.joined.length === 1 && second.joined.length === 1)

    tamper = true
    await first.session.send('hola')

    await until(() => second.status === 'compromised')

    expect(second.messages).toStrictEqual([])
    expect(second.closed).toBe(true)
  })

  it('should abort when a message is replayed', async () => {
    let captured: Bytes | null = null

    const { first, second } = connectPair((frame) => {
      captured = frame

      return frame
    })

    await until(() => first.joined.length === 1 && second.joined.length === 1)
    await first.session.send('hola')
    await until(() => second.messages.length === 1)

    second.session.handleFrame(captured as unknown as Bytes)

    await until(() => second.status === 'compromised')

    expect(second.messages).toStrictEqual(['hola'])
  })

  it('should go back to waiting when the other side leaves', async () => {
    const { first } = await connectReadyPair()

    first.session.handleNotice(PEER_LEFT)

    await until(() => first.status === 'waiting')

    await expect(first.session.send('hola')).rejects.toThrow()
  })

  it('should negotiate new keys when someone takes the place of the other side', async () => {
    const { first, second } = await connectReadyPair()

    first.session.handleNotice(PEER_LEFT)
    second.session.handleNotice(PEER_LEFT)
    await until(() => first.status === 'waiting' && second.status === 'waiting')

    first.session.handleNotice(PEER_JOINED)
    second.session.handleNotice(PEER_JOINED)
    await until(() => first.joined.length === 2 && second.joined.length === 2)

    await first.session.send('otra vez')
    await until(() => second.messages.length === 1)

    expect(second.messages).toStrictEqual(['otra vez'])
  })

  it('should report that a frame could not be delivered', () => {
    const participant = new Participant(authKey, () => undefined)

    participant.session.handleNotice(PEER_UNAVAILABLE)

    expect(participant.undelivered).toBe(1)
  })

  it('should report that the room is full', async () => {
    const participant = new Participant(authKey, () => undefined)

    participant.session.handleClose(ROOM_FULL_CLOSE_CODE)

    await until(() => participant.status === 'room_full')
  })

  it('should report a lost connection', async () => {
    const { first } = await connectReadyPair()

    first.session.handleClose(1006)

    await until(() => first.status === 'disconnected')
  })

  it('should keep the compromised status after the connection closes', async () => {
    const { first, second } = connectPair((frame) => frame, new Uint8Array(32))

    await until(() => first.status === 'compromised' && second.status === 'compromised')

    first.session.handleClose(1000)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(first.status).toBe('compromised')
  })

  it('should not report a lost connection after leaving on purpose', async () => {
    const { first } = await connectReadyPair()
    const statusesBeforeLeaving = first.statuses.length

    first.session.leave()
    first.session.handleClose(1000)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(first.closed).toBe(true)
    expect(first.statuses).toHaveLength(statusesBeforeLeaving)
  })

  it('should ignore a notice it cannot read', async () => {
    const participant = new Participant(authKey, () => undefined)

    participant.session.handleOpen()
    participant.session.handleNotice('not json')
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(participant.status).toBe('waiting')
  })
})
