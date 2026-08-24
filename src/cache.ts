import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { MAX_ARCHIVE_BYTES } from './download'
import { copyVerifiedFile } from './file'

export async function restoreArchive(
  cachedArchive: string,
  destination: string,
  sha256: string
): Promise<boolean> {
  try {
    await mkdir(path.dirname(destination), { recursive: true })
    return await copyVerifiedFile(cachedArchive, destination, sha256, MAX_ARCHIVE_BYTES)
  } catch {
    return false
  }
}

export async function publishArchive(
  source: string,
  cachedArchive: string,
  sha256: string
): Promise<void> {
  const installDir = path.dirname(cachedArchive)
  const publishDir = `${installDir}.${randomUUID()}.tmp`
  const stagedArchive = path.join(publishDir, path.basename(cachedArchive))

  try {
    await mkdir(path.dirname(installDir), { recursive: true })
    await mkdir(publishDir)
    if (!(await copyVerifiedFile(source, stagedArchive, sha256, MAX_ARCHIVE_BYTES))) {
      throw new Error('SHA-256 mismatch while staging the verified Smoque tarball')
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rename(publishDir, installDir)
        return
      } catch (error: unknown) {
        if (await cachedEntryMatches(cachedArchive, publishDir, sha256)) return
        if (!isDestinationConflict(error)) throw error
        await replaceInvalidEntry(installDir)
      }
    }
    throw new Error(`Unable to publish the verified Smoque cache entry at ${installDir}`)
  } finally {
    await rm(publishDir, { force: true, recursive: true })
  }
}

async function cachedEntryMatches(
  cachedArchive: string,
  scratchRoot: string,
  sha256: string
): Promise<boolean> {
  const copy = path.join(scratchRoot, `winner-${randomUUID()}.tgz`)
  try {
    return await copyVerifiedFile(cachedArchive, copy, sha256, MAX_ARCHIVE_BYTES)
  } catch {
    return false
  } finally {
    await rm(copy, { force: true })
  }
}

async function replaceInvalidEntry(installDir: string): Promise<void> {
  const invalidDir = `${installDir}.${randomUUID()}.invalid`
  try {
    await rename(installDir, invalidDir)
    await rm(invalidDir, { force: true, recursive: true })
  } catch (error: unknown) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') throw error
  }
}

function isDestinationConflict(error: unknown): boolean {
  return (
    isErrnoException(error) &&
    (error.code === 'EEXIST' || error.code === 'ENOTEMPTY' || error.code === 'EPERM')
  )
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
