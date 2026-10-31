import { Bytes } from '~/crypto/base64Url'
import { FileSink } from '~/services/transfer/FileExchange'

const MAX_MEMORY_BYTES = 256 * 1024 * 1024
const DOWNLOAD_CLEANUP_DELAY_MS = 60_000

export class FileTooLargeError extends Error {}

interface SaveFilePickerWindow {
  showSaveFilePicker(options: { suggestedName: string }): Promise<FileSystemFileHandle>
}

function hasSavePicker(target: unknown): target is SaveFilePickerWindow {
  return typeof target === 'object' && target !== null && 'showSaveFilePicker' in target
}

function download(file: Blob, name: string): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')

  link.href = url
  link.download = name
  link.click()

  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_CLEANUP_DELAY_MS)
}

class WritableFileSink implements FileSink {
  constructor(
    private readonly writable: FileSystemWritableFileStream,
    private readonly afterClose: () => Promise<void> = () => Promise.resolve(),
    private readonly afterAbort: () => Promise<void> = () => Promise.resolve()
  ) {}

  public async write(chunk: Bytes): Promise<void> {
    await this.writable.write(chunk)
  }

  public async close(): Promise<void> {
    await this.writable.close()
    await this.afterClose()
  }

  public async abort(): Promise<void> {
    await this.writable.abort()
    await this.afterAbort()
  }
}

class MemoryFileSink implements FileSink {
  private chunks: Array<Bytes> = []

  constructor(private readonly name: string) {}

  public write(chunk: Bytes): Promise<void> {
    this.chunks.push(chunk)

    return Promise.resolve()
  }

  public close(): Promise<void> {
    download(new Blob(this.chunks), this.name)
    this.chunks = []

    return Promise.resolve()
  }

  public abort(): Promise<void> {
    this.chunks = []

    return Promise.resolve()
  }
}

async function createPrivateStorageSink(name: string, size: number): Promise<FileSink> {
  const { quota = 0, usage = 0 } = await navigator.storage.estimate()

  if (quota - usage < size) {
    throw new FileTooLargeError()
  }

  const directory = await navigator.storage.getDirectory()
  const temporaryName = crypto.randomUUID()
  const handle = await directory.getFileHandle(temporaryName, { create: true })
  const remove = () => directory.removeEntry(temporaryName)

  return new WritableFileSink(
    await handle.createWritable(),
    async () => {
      download(await handle.getFile(), name)
      setTimeout(() => void remove(), DOWNLOAD_CLEANUP_DELAY_MS)
    },
    remove
  )
}

/**
 * Writes to disk as data arrives, so large files never live in memory. Must be called from a user gesture, because
 * the save dialog requires it. The private storage of the browser covers those without that dialog, at the cost of a
 * temporary second copy, and memory is the last resort for small files
 */
export async function createFileSink(name: string, size: number): Promise<FileSink> {
  if (hasSavePicker(window)) {
    const handle = await window.showSaveFilePicker({ suggestedName: name })

    return new WritableFileSink(await handle.createWritable())
  }

  if ('createWritable' in FileSystemFileHandle.prototype) {
    return createPrivateStorageSink(name, size)
  }

  if (size > MAX_MEMORY_BYTES) {
    throw new FileTooLargeError()
  }

  return new MemoryFileSink(name)
}
