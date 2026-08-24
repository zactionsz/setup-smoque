import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { copyVerifiedFile, sha256File } from '../src/file'

test('hashes and copies a verified regular file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-file-'))
  const source = path.join(root, 'source')
  const destination = path.join(root, 'destination')
  const contents = Buffer.from('smoque archive')
  const digest = createHash('sha256').update(contents).digest('hex')
  try {
    await writeFile(source, contents)
    assert.equal(await sha256File(source), digest)
    assert.equal(await copyVerifiedFile(source, destination, digest, 1024), true)
    assert.deepEqual(await readFile(destination), contents)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('removes a copy whose digest does not match', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-file-'))
  const source = path.join(root, 'source')
  const destination = path.join(root, 'destination')
  try {
    await writeFile(source, 'different')
    assert.equal(await copyVerifiedFile(source, destination, '0'.repeat(64), 1024), false)
    await assert.rejects(readFile(destination))
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('rejects a symbolic-link source', { skip: process.platform === 'win32' }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-file-'))
  try {
    const source = path.join(root, 'source')
    const link = path.join(root, 'link')
    await writeFile(source, 'contents')
    await symlink(source, link)
    await assert.rejects(sha256File(link), /not a regular file/u)
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})
