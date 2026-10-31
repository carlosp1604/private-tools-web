import { Bytes } from '~/crypto/base64Url'
import { FileChannel, FileDescription, FileExchange, FileExchangeStatus, FileSink } from '~/services/transfer/FileExchange'

class MemorySink implements FileSink {
  public readonly chunks: Array<Bytes> = []
  public closed = false
  public aborted = false

  constructor(private readonly delayMs = 0) {}

  public async write(chunk: Bytes): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    }

    this.chunks.push(chunk)
  }

  public close(): Promise<void> {
    this.closed = true

    return Promise.resolve()
  }

  public abort(): Promise<void> {
    this.aborted = true

    return Promise.resolve()
  }

  public get bytes(): Bytes {
    return Uint8Array.from(this.chunks.flatMap((chunk) => [...chunk]))
  }
}

class Side {
  public readonly statuses: Array<FileExchangeStatus> = []
  public readonly progress: Array<number> = []
  public offer: FileDescription | null = null
  public exchange!: FileExchange

  public get status(): FileExchangeStatus | undefined {
    return this.statuses.at(-1)
  }

  public readonly listener = {
    onStatus: (status: FileExchangeStatus) => this.statuses.push(status),
    onOffer: (file: FileDescription) => {
      this.offer = file
    },
    onProgress: (bytes: number) => this.progress.push(bytes),
  }
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 4_000

  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Condition was not met in time')
    }

    await new Promise((resolve) => setTimeout(resolve, 2))
  }
}

describe('FileExchange', () => {
  const content = Uint8Array.from({ length: 100_000 }, (_, index) => index % 251)
  const file = new Blob([content])

  type ChunkFilter = (chunk: Bytes) => Bytes

  const connectSides = (filter: ChunkFilter = (chunk) => chunk) => {
    const sender = new Side()
    const receiver = new Side()
    const stats = { maxInFlight: 0, sent: 0 }

    const toReceiver: FileChannel = {
      sendMessage: (message) => setTimeout(() => receiver.exchange.handleMessage(message), 0),
      sendChunk: (chunk) => {
        stats.sent += chunk.length
        stats.maxInFlight = Math.max(stats.maxInFlight, stats.sent - (sender.progress.at(-1) ?? 0))
        receiver.exchange.handleChunk(filter(chunk))
      },
      waitForDrain: () => Promise.resolve(),
    }

    const toSender: FileChannel = {
      sendMessage: (message) => setTimeout(() => sender.exchange.handleMessage(message), 0),
      sendChunk: () => undefined,
      waitForDrain: () => Promise.resolve(),
    }

    sender.exchange = new FileExchange('sender', toReceiver, sender.listener)
    receiver.exchange = new FileExchange('receiver', toSender, receiver.listener)

    return { sender, receiver, stats }
  }

  const transfer = async (blob: Blob, sink: FileSink, filter?: ChunkFilter) => {
    const sides = connectSides(filter)

    sides.sender.exchange.offer(blob, 'photo.png')
    await until(() => sides.receiver.offer !== null)
    await sides.receiver.exchange.accept(sink)

    return sides
  }

  it('should tell the receiver what is coming before sending anything', async () => {
    const { sender, receiver } = connectSides()

    sender.exchange.offer(file, 'photo.png')
    await until(() => receiver.offer !== null)

    expect(receiver.offer).toStrictEqual({ name: 'photo.png', size: content.length })
    expect(sender.status).toBe('offered')
  })

  it('should deliver the file intact', async () => {
    const sink = new MemorySink()
    const { sender, receiver } = await transfer(file, sink)

    await until(() => sender.status === 'completed' && receiver.status === 'completed')

    expect(sink.bytes).toStrictEqual(content)
    expect(sink.closed).toBe(true)
  })

  it('should report the final progress on both sides', async () => {
    const { sender, receiver } = await transfer(file, new MemorySink())

    await until(() => sender.status === 'completed')

    expect(sender.progress.at(-1)).toBe(content.length)
    expect(receiver.progress.at(-1)).toBe(content.length)
  })

  it('should deliver an empty file', async () => {
    const sink = new MemorySink()
    const { receiver } = await transfer(new Blob([]), sink)

    await until(() => receiver.status === 'completed')

    expect(sink.closed).toBe(true)
  })

  it('should detect a file that changed on the way', async () => {
    const sink = new MemorySink()
    const { sender, receiver } = await transfer(file, sink, (chunk) => {
      const altered = chunk.slice()

      altered[0] = (altered[0] ?? 0) ^ 1

      return altered
    })

    await until(() => sender.status === 'corrupted' && receiver.status === 'corrupted')

    expect(sink.aborted).toBe(true)
    expect(sink.closed).toBe(false)
  })

  it('should stop a file larger than announced', async () => {
    const sink = new MemorySink()
    const { receiver } = connectSides()

    receiver.exchange.handleMessage(JSON.stringify({ type: 'file', name: 'small', size: 1 }))
    await receiver.exchange.accept(sink)
    receiver.exchange.handleChunk(new Uint8Array(2))

    await until(() => receiver.status === 'failed')

    expect(sink.aborted).toBe(true)
  })

  it('should not overrun a slow disk', async () => {
    const big = new Blob([new Uint8Array(12 * 1024 * 1024)])
    const sink = new MemorySink(0)
    const { sender, stats } = await transfer(big, sink)

    await until(() => sender.status === 'completed')

    expect(stats.maxInFlight).toBeLessThanOrEqual(8 * 1024 * 1024 + 16 * 1024)
  }, 20_000)

  it('should discard what was written when the transfer is abandoned', async () => {
    const sink = new MemorySink()
    const { receiver } = await transfer(file, sink)

    receiver.exchange.abort()

    await until(() => sink.aborted)

    expect(receiver.status).toBe('failed')
  })

  it('should only abandon a transfer once', async () => {
    const { receiver } = await transfer(file, new MemorySink())

    receiver.exchange.abort()
    receiver.exchange.abort()

    expect(receiver.statuses.filter((status) => status === 'failed')).toHaveLength(1)
  })

  it('should keep the result of a finished transfer when the room closes', async () => {
    const { sender, receiver } = await transfer(file, new MemorySink())

    await until(() => sender.status === 'completed' && receiver.status === 'completed')

    sender.exchange.abort()

    expect(sender.status).toBe('completed')
  })
})
