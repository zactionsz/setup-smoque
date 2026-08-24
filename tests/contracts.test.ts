import assert from 'node:assert/strict'
import test from 'node:test'
import {
  archiveName,
  cacheDirectory,
  launcherName,
  packageUrl,
  requireSha256,
  requireVersion
} from '../src/contracts'

test('accepts exact stable and prerelease versions', () => {
  assert.equal(requireVersion(' 0.1.2 '), '0.1.2')
  assert.equal(requireVersion('1.0.0-alpha.2'), '1.0.0-alpha.2')
})

test('rejects ranges, tags, and unsafe version values', () => {
  for (const value of ['latest', '^0.1.2', 'v0.1.2', '../0.1.2', '1.2']) {
    assert.throws(() => requireVersion(value), /Invalid version/u)
  }
})

test('normalizes a valid SHA-256 digest', () => {
  assert.equal(requireSha256('A'.repeat(64)), 'a'.repeat(64))
  assert.throws(() => requireSha256('a'.repeat(63)), /Invalid sha256/u)
})

test('derives immutable package and cache locations', () => {
  assert.equal(archiveName('0.1.2'), 'smoque-0.1.2.tgz')
  assert.equal(
    packageUrl('0.1.2'),
    'https://registry.npmjs.org/smoque/-/smoque-0.1.2.tgz'
  )
  assert.match(cacheDirectory('/cache', '0.1.2', 'a'.repeat(64)), /smoque.*0\.1\.2/u)
  assert.equal(launcherName('linux'), 'smoque')
  assert.equal(launcherName('win32'), 'smoque.cmd')
})
