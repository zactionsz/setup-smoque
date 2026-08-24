import path from 'node:path'

const NPM_TARBALL_BASE_URL = 'https://registry.npmjs.org/smoque/-'
const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/u

export function requireVersion(value: string): string {
  const version = value.trim()
  if (!VERSION_PATTERN.test(version)) {
    throw new Error('Invalid version; expected an exact version such as 0.1.2')
  }
  return version
}

export function requireSha256(value: string): string {
  const sha256 = value.trim()
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error('Invalid sha256; expected exactly 64 hexadecimal characters')
  }
  return sha256.toLowerCase()
}

export function archiveName(version: string): string {
  return `smoque-${version}.tgz`
}

export function packageUrl(version: string): string {
  return `${NPM_TARBALL_BASE_URL}/${archiveName(version)}`
}

export function cacheDirectory(toolCache: string, version: string, sha256: string): string {
  return path.resolve(toolCache, 'smoque', version, sha256)
}

export function launcherName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'smoque.cmd' : 'smoque'
}
