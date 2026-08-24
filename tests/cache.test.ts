import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { publishArchive, restoreArchive } from '../src/cache'

test('publishes and restores only the verified tarball', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-cache-'))
  const source = path.join(root, 'source.tgz')
  const cached = path.join(root, 'cache', 'version', 'smoque.tgz')
  const restored = path.join(root, 'private', 'smoque.tgz')
  const contents = Buffer.from('published tarball')
  const digest = createHash('sha256').update(contents).digest('hex')
  try {
    await writeFile(source, contents)
    await publishArchive(source, cached, digest)
    assert.equal(await restoreArchive(cached, restored, digest), true)
    assert.deepEqual(await readFile(restored), contents)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('treats a corrupt cache entry as a miss', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-cache-'))
  const cached = path.join(root, 'cache.tgz')
  try {
    await writeFile(cached, 'corrupt')
    assert.equal(
      await restoreArchive(cached, path.join(root, 'restored.tgz'), '0'.repeat(64)),
      false
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})
