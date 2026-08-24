import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { runAction } from '../src/action'

const archiveContents = Buffer.from('verified package')
const sha256 = createHash('sha256').update(archiveContents).digest('hex')

test('downloads, verifies, installs, and publishes outputs', async () => {
  const fixture = await actionFixture()
  let downloadedUrl = ''
  let published = false
  try {
    const result = await runAction(fixture.environment, {
      download: async (url, destination) => {
        downloadedUrl = url
        await writeFile(destination, archiveContents)
      },
      installPackage: async (_archive, installRoot) => ({
        binDirectory: path.join(installRoot, 'node_modules', '.bin'),
        launcherPath: path.join(installRoot, 'node_modules', '.bin', 'smoque')
      }),
      publishArchive: async () => {
        published = true
      },
      restoreArchive: async () => false
    })

    assert.equal(downloadedUrl, 'https://registry.npmjs.org/smoque/-/smoque-0.1.2.tgz')
    assert.equal(published, true)
    assert.equal(result.cacheHit, false)
    assert.match(await readFile(fixture.output, 'utf8'), /version=0\.1\.2/u)
    assert.match(await readFile(fixture.output, 'utf8'), /cache-hit=false/u)
    assert.match(await readFile(fixture.pathFile, 'utf8'), /node_modules.*\.bin/u)
  } finally {
    await rm(fixture.root, { force: true, recursive: true })
  }
})

test('uses a privately copied verified cache archive', async () => {
  const fixture = await actionFixture()
  let downloaded = false
  try {
    const result = await runAction(fixture.environment, {
      download: async () => {
        downloaded = true
      },
      installPackage: async (_archive, installRoot) => ({
        binDirectory: path.join(installRoot, 'bin'),
        launcherPath: path.join(installRoot, 'bin', 'smoque')
      }),
      publishArchive: async () => undefined,
      restoreArchive: async (_cached, destination) => {
        await writeFile(destination, archiveContents)
        return true
      }
    })

    assert.equal(downloaded, false)
    assert.equal(result.cacheHit, true)
    assert.match(await readFile(fixture.output, 'utf8'), /cache-hit=true/u)
  } finally {
    await rm(fixture.root, { force: true, recursive: true })
  }
})

test('fails closed on a SHA-256 mismatch', async () => {
  const fixture = await actionFixture()
  let installed = false
  try {
    await assert.rejects(
      runAction(fixture.environment, {
        download: async (_url, destination) => {
          await writeFile(destination, 'wrong')
        },
        installPackage: async () => {
          installed = true
          return { binDirectory: '', launcherPath: '' }
        },
        publishArchive: async () => undefined,
        restoreArchive: async () => false
      }),
      /SHA-256 mismatch/u
    )
    assert.equal(installed, false)
  } finally {
    await rm(fixture.root, { force: true, recursive: true })
  }
})

async function actionFixture(): Promise<{
  environment: NodeJS.ProcessEnv
  output: string
  pathFile: string
  root: string
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'setup-smoque-action-'))
  const output = path.join(root, 'output')
  const pathFile = path.join(root, 'path')
  await writeFile(output, '')
  await writeFile(pathFile, '')
  return {
    environment: {
      GITHUB_OUTPUT: output,
      GITHUB_PATH: pathFile,
      INPUT_SHA256: sha256,
      INPUT_VERSION: '0.1.2',
      RUNNER_TEMP: path.join(root, 'temp'),
      RUNNER_TOOL_CACHE: path.join(root, 'cache')
    },
    output,
    pathFile,
    root
  }
}
