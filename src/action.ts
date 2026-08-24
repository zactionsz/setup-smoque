import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { publishArchive, restoreArchive } from './cache'
import {
  archiveName,
  cacheDirectory,
  packageUrl,
  requireSha256,
  requireVersion
} from './contracts'
import { download } from './download'
import { sha256File } from './file'
import * as github from './github'
import { installPackage } from './install'

interface ActionDependencies {
  download: typeof download
  installPackage: typeof installPackage
  publishArchive: typeof publishArchive
  restoreArchive: typeof restoreArchive
  sha256File: typeof sha256File
}

export interface ActionResult {
  cacheHit: boolean
  launcherPath: string
  sha256: string
  version: string
}

export async function runAction(
  environment: NodeJS.ProcessEnv = process.env,
  overrides: Partial<ActionDependencies> = {}
): Promise<ActionResult> {
  const dependencies: ActionDependencies = {
    download,
    installPackage,
    publishArchive,
    restoreArchive,
    sha256File,
    ...overrides
  }
  const version = requireVersion(github.input('version', environment))
  const expectedSha256 = requireSha256(github.input('sha256', environment))
  const toolCache = environment.RUNNER_TOOL_CACHE ?? environment.RUNNER_TEMP ?? os.tmpdir()
  const runnerTemp = environment.RUNNER_TEMP ?? os.tmpdir()
  const cacheDir = cacheDirectory(toolCache, version, expectedSha256)
  const cachedArchive = path.join(cacheDir, archiveName(version))
  const stagingRoot = path.resolve(
    runnerTemp,
    'setup-smoque-staging',
    `${version}-${randomUUID()}`
  )
  const archive = path.join(stagingRoot, archiveName(version))
  const activationRoot = path.resolve(
    runnerTemp,
    'setup-smoque-active',
    `${version}-${expectedSha256}-${randomUUID()}`
  )

  let cacheHit = false
  try {
    await mkdir(stagingRoot, { recursive: true })
    cacheHit = await dependencies.restoreArchive(cachedArchive, archive, expectedSha256)
    if (cacheHit) {
      github.info(`Using verified cached Smoque ${version} tarball`)
    } else {
      github.info(`Downloading Smoque ${version}`)
      await dependencies.download(packageUrl(version), archive)
      const actualSha256 = await dependencies.sha256File(archive)
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `SHA-256 mismatch for ${archiveName(version)}: expected ` +
            `${expectedSha256}, received ${actualSha256}`
        )
      }
      await dependencies.publishArchive(archive, cachedArchive, expectedSha256)
    }

    const installation = await dependencies.installPackage(
      archive,
      activationRoot,
      version,
      runnerTemp
    )
    github.addPath(path.dirname(process.execPath), environment)
    github.addPath(installation.binDirectory, environment)
    github.setOutput('version', version, environment)
    github.setOutput('sha256', expectedSha256, environment)
    github.setOutput('path', installation.launcherPath, environment)
    github.setOutput('cache-hit', String(cacheHit), environment)
    github.info(`Installed and verified Smoque ${version}`)

    return {
      cacheHit,
      launcherPath: installation.launcherPath,
      sha256: expectedSha256,
      version
    }
  } catch (error: unknown) {
    await rm(activationRoot, { force: true, recursive: true })
    throw error
  } finally {
    await rm(stagingRoot, { force: true, recursive: true })
  }
}
