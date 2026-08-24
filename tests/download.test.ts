import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { download, MAX_ARCHIVE_BYTES } from '../src/download'

test('downloads a package body without following redirects', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-download-'))
  const destination = path.join(root, 'smoque.tgz')
  let request: RequestInit | undefined
  try {
    await download('https://registry.example/smoque.tgz', destination, async (_url, init) => {
      request = init
      return new Response('verified bytes', { status: 200 })
    })

    assert.equal(await readFile(destination, 'utf8'), 'verified bytes')
    assert.equal(request?.redirect, 'error')
    assert.equal(new Headers(request?.headers).get('user-agent'), 'zactionsz/setup-smoque')
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('rejects oversized declared downloads without leaving a destination', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-download-'))
  const destination = path.join(root, 'smoque.tgz')
  try {
    await assert.rejects(
      download('https://registry.example/smoque.tgz', destination, async () =>
        new Response('small', {
          headers: { 'content-length': String(MAX_ARCHIVE_BYTES + 1) },
          status: 200
        })
      ),
      /safety limit/u
    )
    await assert.rejects(access(destination))
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('reports non-successful registry responses', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-download-'))
  try {
    await assert.rejects(
      download('https://registry.example/missing.tgz', path.join(root, 'missing'), async () =>
        new Response('missing', { status: 404 })
      ),
      /HTTP 404/u
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})
