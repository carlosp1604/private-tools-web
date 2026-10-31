import { createSHA256, IHasher } from 'hash-wasm'
import { Bytes } from '~/crypto/base64Url'
import { TransferRole } from '~/services/transfer/TransferConnection'

const CHUNK_BYTES = 16 * 1024
const WINDOW_BYTES = 8 * 1024 * 1024
const ACKNOWLEDGEMENT_BYTES = 512 * 1024

export type FileExchangeStatus = 'idle' | 'offered' | 'transferring' | 'verifying' | 'completed' | 'corrupted' | 'failed'

export interface FileDescription {
  name: string
  size: number
}

export interface FileChannel {
  sendMessage(message: string): void
  sendChunk(chunk: Bytes): void
  waitForDrain(): Promise<void>
}

export interface FileSink {
  write(chunk: Bytes): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
}

export interface FileExchangeListener {
  onStatus(status: FileExchangeStatus): void
  onOffer(file: FileDescription): void
  onProgress(bytes: number): void
}

type FileMessage =
  | { type: 'file'; name: string; size: number }
  | { type: 'accept' }
  | { type: 'progress'; bytes: number }
  | { type: 'done'; hash: string }
  | { type: 'result'; intact: boolean }

/**
 * Moves one file over a reliable channel. The receiver acknowledges what it has written, and the sender stops when
 * too much is unacknowledged, so a slow disk cannot fill the memory. The final hash covers what went through both ends
 */
export class FileExchange {
  private status: FileExchangeStatus = 'idle'
  private file: Blob | null = null
  private description: FileDescription | null = null
  private sink: FileSink | null = null
  private hasher: IHasher | null = null
  private bytes = 0
  private acknowledged = 0
  private resumeSender: (() => void) | null = null
  private writes: Promise<void> = Promise.resolve()

  constructor(
    private readonly role: TransferRole,
    private readonly channel: FileChannel,
    private readonly listener: FileExchangeListener
  ) {}

  public offer(file: Blob, name: string): void {
    this.file = file
    this.description = { name, size: file.size }

    this.setStatus('offered')
    this.sendMessage({ type: 'file', name, size: file.size })
  }

  public async accept(sink: FileSink): Promise<void> {
    this.sink = sink
    this.hasher = await createSHA256()
    this.hasher.init()

    this.setStatus('transferring')
    this.sendMessage({ type: 'accept' })
  }

  public handleMessage(rawMessage: string): void {
    const message = JSON.parse(rawMessage) as FileMessage

    if (message.type === 'file' && this.role === 'receiver') {
      this.description = { name: message.name, size: message.size }
      this.listener.onOffer(this.description)
    } else if (message.type === 'accept' && this.role === 'sender') {
      void this.sendFile().catch(() => this.fail())
    } else if (message.type === 'progress' && this.role === 'sender') {
      this.acknowledge(message.bytes)
    } else if (message.type === 'done' && this.role === 'receiver') {
      this.writes = this.writes.then(() => this.finishReceiving(message.hash))
    } else if (message.type === 'result' && this.role === 'sender') {
      this.setStatus(message.intact ? 'completed' : 'corrupted')
    }
  }

  public handleChunk(chunk: Bytes): void {
    this.writes = this.writes.then(() => this.writeChunk(chunk)).catch(() => this.fail())
  }

  public abort(): void {
    if (this.status === 'failed') {
      return
    }

    if (this.status !== 'completed' && this.status !== 'corrupted') {
      this.setStatus('failed')
    }

    void this.sink?.abort().catch(() => undefined)
    this.sink = null
    this.resumeSender?.()
  }

  private async sendFile(): Promise<void> {
    if (!this.file) {
      throw new Error('There is no file to send')
    }

    const hasher = await createSHA256()

    hasher.init()
    this.setStatus('transferring')

    let offset = 0

    while (offset < this.file.size && this.status === 'transferring') {
      await this.waitForWindow(offset)
      await this.channel.waitForDrain()

      const chunk = new Uint8Array(await this.file.slice(offset, offset + CHUNK_BYTES).arrayBuffer())

      hasher.update(chunk)
      this.channel.sendChunk(chunk)

      offset += chunk.length
    }

    if (this.status === 'transferring') {
      this.setStatus('verifying')
      this.sendMessage({ type: 'done', hash: hasher.digest('hex') })
    }
  }

  private waitForWindow(offset: number): Promise<void> {
    if (offset - this.acknowledged < WINDOW_BYTES || this.status !== 'transferring') {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      this.resumeSender = resolve
    })
  }

  private acknowledge(bytes: number): void {
    this.acknowledged = bytes
    this.listener.onProgress(bytes)
    this.resumeSender?.()
    this.resumeSender = null
  }

  private async writeChunk(chunk: Bytes): Promise<void> {
    if (!this.sink || !this.hasher || !this.description) {
      throw new Error('Unexpected chunk')
    }

    if (this.bytes + chunk.length > this.description.size) {
      throw new Error('The file is larger than announced')
    }

    await this.sink.write(chunk)

    this.hasher.update(chunk)

    const previousBytes = this.bytes

    this.bytes += chunk.length

    const crossedAcknowledgement = Math.floor(this.bytes / ACKNOWLEDGEMENT_BYTES) > Math.floor(previousBytes / ACKNOWLEDGEMENT_BYTES)

    if (crossedAcknowledgement || this.bytes === this.description.size) {
      this.sendMessage({ type: 'progress', bytes: this.bytes })
      this.listener.onProgress(this.bytes)
    }
  }

  private async finishReceiving(expectedHash: string): Promise<void> {
    if (!this.sink || !this.hasher || !this.description) {
      return
    }

    this.setStatus('verifying')

    const intact = this.bytes === this.description.size && this.hasher.digest('hex') === expectedHash

    if (intact) {
      await this.sink.close()
    } else {
      await this.sink.abort()
    }

    this.sink = null
    this.sendMessage({ type: 'result', intact })
    this.setStatus(intact ? 'completed' : 'corrupted')
  }

  private fail(): void {
    this.abort()
  }

  private sendMessage(message: FileMessage): void {
    this.channel.sendMessage(JSON.stringify(message))
  }

  private setStatus(status: FileExchangeStatus): void {
    this.status = status
    this.listener.onStatus(status)
  }
}
