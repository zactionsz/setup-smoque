import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, realpath, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { launcherName } from './contracts'

export const COMMAND_TIMEOUT_MS = 60_000

interface PackageMetadata {
  bin?: string | Record<string, string>
  dependencies?: Record<string, string>
  name?: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  version?: string
}

export interface InstallResult {
  binDirectory: string
  launcherPath: string
}

export type RunCommand = (
  command: string,
  args: string[],
  environment: NodeJS.ProcessEnv
) => void

interface NpmInvocation {
  args: string[]
  command: string
}

type LocateWindowsNpm = () => string

export async function installPackage(
  archive: string,
  installRoot: string,
  version: string,
  runnerTemp: string,
  runCommand: RunCommand = run
): Promise<InstallResult> {
  const npm = resolveNpmInvocation()
  const environment = {
    ...process.env,
    npm_config_cache: path.join(runnerTemp, 'setup-smoque-npm-cache')
  }
  runCommand(
    npm.command,
    [
      ...npm.args,
      'install',
      '--prefix',
      installRoot,
      '--ignore-scripts',
      '--bin-links=false',
      '--no-save',
      '--package-lock=false',
      '--audit=false',
      '--fund=false',
      '--offline',
      archive
    ],
    environment
  )

  const packageRoot = path.join(installRoot, 'node_modules', 'smoque')
  const metadata = JSON.parse(
    await readFile(path.join(packageRoot, 'package.json'), 'utf8')
  ) as PackageMetadata
  if (metadata.name !== 'smoque' || metadata.version !== version) {
    throw new Error(
      `Installed package identity was ${metadata.name ?? '<missing>'}@` +
        `${metadata.version ?? '<missing>'}, expected smoque@${version}`
    )
  }
  assertExpectedLauncher(metadata)
  assertNoRuntimeDependencies(metadata)

  const cli = path.join(packageRoot, 'dist', 'cli', 'main.js')
  await requireRegularFile(cli)
  const versionResult = spawnSync(process.execPath, [cli, '--version'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true
  })
  if (versionResult.error) {
    throw new Error(`Unable to run installed Smoque: ${versionResult.error.message}`)
  }
  if (versionResult.status !== 0 || versionResult.stdout.trim() !== version) {
    throw new Error(`Installed Smoque did not report the expected version ${version}`)
  }

  const { binDirectory, launcherPath } = await createLauncher(installRoot, cli)
  return { binDirectory, launcherPath }
}

export function resolveNpmInvocation(
  platform: NodeJS.Platform = process.platform,
  locateWindowsNpm: LocateWindowsNpm = locateWindowsNpmCli
): NpmInvocation {
  if (platform !== 'win32') return { args: [], command: 'npm' }
  return { args: [locateWindowsNpm()], command: process.execPath }
}

function assertNoRuntimeDependencies(metadata: PackageMetadata): void {
  for (const [field, dependencies] of [
    ['dependencies', metadata.dependencies],
    ['optionalDependencies', metadata.optionalDependencies],
    ['peerDependencies', metadata.peerDependencies]
  ] as const) {
    if (dependencies && Object.keys(dependencies).length > 0) {
      throw new Error(`smoque declares ${field}; setup-smoque requires a self-contained release`)
    }
  }
}

function assertExpectedLauncher(metadata: PackageMetadata): void {
  const launcher =
    typeof metadata.bin === 'object' && metadata.bin !== null
      ? metadata.bin.smoque
      : undefined
  if (launcher !== 'dist/cli/main.js') {
    throw new Error(
      `Installed package bin.smoque was ${launcher ?? '<missing>'}, ` +
        'expected dist/cli/main.js'
    )
  }
}

async function createLauncher(
  installRoot: string,
  cli: string
): Promise<InstallResult> {
  const binDirectory = path.join(installRoot, 'bin')
  const launcherPath = path.join(binDirectory, launcherName())
  await mkdir(binDirectory)

  if (process.platform === 'win32') {
    const node = quoteBatchPath(process.execPath)
    const relativeCli = '%~dp0..\\node_modules\\smoque\\dist\\cli\\main.js'
    await writeFile(
      launcherPath,
      `@ECHO OFF\r\n${node} "${relativeCli}" %*\r\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o700 }
    )
  } else {
    await symlink(path.relative(binDirectory, cli), launcherPath, 'file')
    const [resolvedLauncher, resolvedCli] = await Promise.all([
      realpath(launcherPath),
      realpath(cli)
    ])
    if (resolvedLauncher !== resolvedCli) {
      throw new Error('Installed Smoque launcher does not resolve to the verified CLI')
    }
  }

  await requireRegularFile(launcherPath)
  return { binDirectory, launcherPath }
}

function quoteBatchPath(value: string): string {
  if (/\r|\n|"/u.test(value)) throw new Error('Unable to encode the Action Node path')
  return `"${value.replaceAll('%', '%%')}"`
}

async function requireRegularFile(file: string): Promise<void> {
  const metadata = await stat(file)
  if (!metadata.isFile()) throw new Error(`${file} is not a regular file`)
}

function locateWindowsNpmCli(): string {
  const result = spawnSync('where.exe', ['npm.cmd'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true
  })
  if (result.error || result.status !== 0) {
    throw new Error('Unable to locate npm.cmd on the Windows runner PATH')
  }

  for (const command of result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)) {
    const cli = path.join(path.dirname(command), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (existsSync(cli)) return cli
  }
  throw new Error('Unable to locate npm-cli.js beside npm.cmd on the Windows runner PATH')
}

function run(command: string, args: string[], environment: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: environment,
    maxBuffer: 16 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true
  })
  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
    throw new Error(`${command} exited with status ${result.status}: ${output}`)
  }
}
