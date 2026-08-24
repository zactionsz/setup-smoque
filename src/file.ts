import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, open, rm, type FileHandle } from 'node:fs/promises'

export async function sha256File(file: string): Promise<string> {
  const handle = await openStableRegularFile(file)
  try {
    const hash = createHash('sha256')
    await readHandle(handle, (chunk) => {
      hash.update(chunk)
    })
    return hash.digest('hex')
  } finally {
    await handle.close()
  }
}

export async function copyVerifiedFile(
  source: string,
  destination: string,
  expectedSha256: string,
  maxBytes: number
): Promise<boolean> {
  const sourceHandle = await openStableRegularFile(source)
  const hash = createHash('sha256')
  let received = 0
  let destinationCreated = false

  try {
    const destinationHandle = await open(destination, 'wx', 0o600)
    destinationCreated = true
    try {
      await readHandle(sourceHandle, async (chunk) => {
        received += chunk.length
        if (received > maxBytes) {
          throw new Error(`File exceeds the ${maxBytes}-byte safety limit`)
        }
        hash.update(chunk)
        await writeAll(destinationHandle, chunk)
      })
    } finally {
      await destinationHandle.close()
    }
    const matches = hash.digest('hex') === expectedSha256
    if (!matches) await rm(destination, { force: true })
    return matches
  } catch (error: unknown) {
    if (destinationCreated) await rm(destination, { force: true })
    throw error
  } finally {
    await sourceHandle.close()
  }
}

async function openStableRegularFile(file: string): Promise<FileHandle> {
  const before = await lstat(file, { bigint: true })
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${file} is not a regular file`)
  }

  const noFollow = process.platform === 'win32' ? 0 : constants.O_NOFOLLOW
  const handle = await open(file, constants.O_RDONLY | noFollow)
  try {
    const after = await handle.stat({ bigint: true })
    if (
      !after.isFile() ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size
    ) {
      throw new Error(`${file} changed while it was being opened`)
    }
    return handle
  } catch (error: unknown) {
    await handle.close()
    throw error
  }
}

async function readHandle(
  handle: FileHandle,
  consume: (chunk: Buffer) => void | Promise<void>
): Promise<void> {
  const buffer = Buffer.allocUnsafe(64 * 1024)
  let position = 0
  while (true) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
    if (bytesRead === 0) return
    await consume(buffer.subarray(0, bytesRead))
    position += bytesRead
  }
}

async function writeAll(handle: FileHandle, contents: Buffer): Promise<void> {
  let offset = 0
  while (offset < contents.length) {
    const { bytesWritten } = await handle.write(contents, offset, contents.length - offset)
    if (bytesWritten === 0) throw new Error('Unable to make progress while copying a file')
    offset += bytesWritten
  }
}
