import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { installPackage, resolveNpmInvocation, type RunCommand } from '../src/install'

test('installs a self-contained package with scripts and network disabled', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-install-'))
  const archive = path.join(root, 'smoque.tgz')
  const installRoot = path.join(root, 'install')
  let receivedArgs: string[] = []
  try {
    const run: RunCommand = (_command, args) => {
      receivedArgs = args
      writeInstalledFixture(installRoot, { name: 'smoque', version: '0.1.2' })
    }
    const result = await installPackage(archive, installRoot, '0.1.2', root, run)

    assert.ok(receivedArgs.includes('--ignore-scripts'))
    assert.ok(receivedArgs.includes('--offline'))
    assert.ok(receivedArgs.includes('--package-lock=false'))
    assert.equal(result.binDirectory, path.join(installRoot, 'node_modules', '.bin'))
    assert.equal(path.basename(result.launcherPath), process.platform === 'win32' ? 'smoque.cmd' : 'smoque')
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('rejects a release with runtime dependencies', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-install-'))
  const installRoot = path.join(root, 'install')
  try {
    const run: RunCommand = () => {
      writeInstalledFixture(installRoot, {
        dependencies: { drift: '^1.0.0' },
        name: 'smoque',
        version: '0.1.2'
      })
    }
    await assert.rejects(
      installPackage(path.join(root, 'smoque.tgz'), installRoot, '0.1.2', root, run),
      /declares dependencies/u
    )
  } finally {
    await rm(root, { force: true, recursive: true })
  }
})

test('invokes the Windows npm CLI through the Action Node runtime', () => {
  const invocation = resolveNpmInvocation('win32', () => 'C:\\node\\npm-cli.js')

  assert.equal(invocation.command, process.execPath)
  assert.deepEqual(invocation.args, ['C:\\node\\npm-cli.js'])
})

function writeInstalledFixture(installRoot: string, metadata: object): void {
  const packageRoot = path.join(installRoot, 'node_modules', 'smoque')
  const binDirectory = path.join(installRoot, 'node_modules', '.bin')
  mkdirSync(path.join(packageRoot, 'dist', 'cli'), { recursive: true })
  mkdirSync(binDirectory, { recursive: true })
  writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify(metadata))
  writeFileSync(
    path.join(packageRoot, 'dist', 'cli', 'main.js'),
    'process.stdout.write("0.1.2\\n")\n'
  )
  writeFileSync(path.join(binDirectory, process.platform === 'win32' ? 'smoque.cmd' : 'smoque'), '')
}
