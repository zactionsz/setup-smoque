"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/action.ts
var import_node_crypto4 = require("node:crypto");
var import_promises6 = require("node:fs/promises");
var import_node_os2 = __toESM(require("node:os"));
var import_node_path5 = __toESM(require("node:path"));

// src/cache.ts
var import_node_crypto3 = require("node:crypto");
var import_promises4 = require("node:fs/promises");
var import_node_path2 = __toESM(require("node:path"));

// src/download.ts
var import_node_crypto = require("node:crypto");
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
var import_node_stream = require("node:stream");
var import_promises2 = require("node:stream/promises");
var MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
var DOWNLOAD_TIMEOUT_MS = 6e4;
async function download(url, destination, fetchImpl = fetch) {
  await (0, import_promises.mkdir)(import_node_path.default.dirname(destination), { recursive: true });
  const temporary = `${destination}.${(0, import_node_crypto.randomUUID)()}.tmp`;
  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": "zactionsz/setup-smoque" },
      redirect: "error",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
    });
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status} for ${url}`);
    }
    if (!response.body) {
      throw new Error(`Download returned an empty response body for ${url}`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_BYTES) {
      throw new Error(`Download exceeds the ${MAX_ARCHIVE_BYTES}-byte safety limit`);
    }
    let received = 0;
    const limit = new import_node_stream.Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_ARCHIVE_BYTES) {
          callback(new Error(`Download exceeds the ${MAX_ARCHIVE_BYTES}-byte safety limit`));
          return;
        }
        callback(null, chunk);
      }
    });
    await (0, import_promises2.pipeline)(
      import_node_stream.Readable.fromWeb(response.body),
      limit,
      (0, import_node_fs.createWriteStream)(temporary, { flags: "wx" })
    );
    await (0, import_promises.rename)(temporary, destination);
  } catch (error) {
    await (0, import_promises.rm)(temporary, { force: true });
    throw error;
  }
}

// src/file.ts
var import_node_crypto2 = require("node:crypto");
var import_node_fs2 = require("node:fs");
var import_promises3 = require("node:fs/promises");
async function sha256File(file) {
  const handle = await openStableRegularFile(file);
  try {
    const hash = (0, import_node_crypto2.createHash)("sha256");
    await readHandle(handle, (chunk) => {
      hash.update(chunk);
    });
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}
async function copyVerifiedFile(source, destination, expectedSha256, maxBytes) {
  const sourceHandle = await openStableRegularFile(source);
  const hash = (0, import_node_crypto2.createHash)("sha256");
  let received = 0;
  let destinationCreated = false;
  try {
    const destinationHandle = await (0, import_promises3.open)(destination, "wx", 384);
    destinationCreated = true;
    try {
      await readHandle(sourceHandle, async (chunk) => {
        received += chunk.length;
        if (received > maxBytes) {
          throw new Error(`File exceeds the ${maxBytes}-byte safety limit`);
        }
        hash.update(chunk);
        await writeAll(destinationHandle, chunk);
      });
    } finally {
      await destinationHandle.close();
    }
    const matches = hash.digest("hex") === expectedSha256;
    if (!matches) await (0, import_promises3.rm)(destination, { force: true });
    return matches;
  } catch (error) {
    if (destinationCreated) await (0, import_promises3.rm)(destination, { force: true });
    throw error;
  } finally {
    await sourceHandle.close();
  }
}
async function openStableRegularFile(file) {
  const before = await (0, import_promises3.lstat)(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error(`${file} is not a regular file`);
  }
  const noFollow = process.platform === "win32" ? 0 : import_node_fs2.constants.O_NOFOLLOW;
  const handle = await (0, import_promises3.open)(file, import_node_fs2.constants.O_RDONLY | noFollow);
  try {
    const after = await handle.stat({ bigint: true });
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
      throw new Error(`${file} changed while it was being opened`);
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}
async function readHandle(handle, consume) {
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let position = 0;
  while (true) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
    if (bytesRead === 0) return;
    await consume(buffer.subarray(0, bytesRead));
    position += bytesRead;
  }
}
async function writeAll(handle, contents) {
  let offset = 0;
  while (offset < contents.length) {
    const { bytesWritten } = await handle.write(contents, offset, contents.length - offset);
    if (bytesWritten === 0) throw new Error("Unable to make progress while copying a file");
    offset += bytesWritten;
  }
}

// src/cache.ts
async function restoreArchive(cachedArchive, destination, sha256) {
  try {
    await (0, import_promises4.mkdir)(import_node_path2.default.dirname(destination), { recursive: true });
    return await copyVerifiedFile(cachedArchive, destination, sha256, MAX_ARCHIVE_BYTES);
  } catch {
    return false;
  }
}
async function publishArchive(source, cachedArchive, sha256) {
  const installDir = import_node_path2.default.dirname(cachedArchive);
  const publishDir = `${installDir}.${(0, import_node_crypto3.randomUUID)()}.tmp`;
  const stagedArchive = import_node_path2.default.join(publishDir, import_node_path2.default.basename(cachedArchive));
  try {
    await (0, import_promises4.mkdir)(import_node_path2.default.dirname(installDir), { recursive: true });
    await (0, import_promises4.mkdir)(publishDir);
    if (!await copyVerifiedFile(source, stagedArchive, sha256, MAX_ARCHIVE_BYTES)) {
      throw new Error("SHA-256 mismatch while staging the verified Smoque tarball");
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await (0, import_promises4.rename)(publishDir, installDir);
        return;
      } catch (error) {
        if (await cachedEntryMatches(cachedArchive, publishDir, sha256)) return;
        if (!isDestinationConflict(error)) throw error;
        await replaceInvalidEntry(installDir);
      }
    }
    throw new Error(`Unable to publish the verified Smoque cache entry at ${installDir}`);
  } finally {
    await (0, import_promises4.rm)(publishDir, { force: true, recursive: true });
  }
}
async function cachedEntryMatches(cachedArchive, scratchRoot, sha256) {
  const copy = import_node_path2.default.join(scratchRoot, `winner-${(0, import_node_crypto3.randomUUID)()}.tgz`);
  try {
    return await copyVerifiedFile(cachedArchive, copy, sha256, MAX_ARCHIVE_BYTES);
  } catch {
    return false;
  } finally {
    await (0, import_promises4.rm)(copy, { force: true });
  }
}
async function replaceInvalidEntry(installDir) {
  const invalidDir = `${installDir}.${(0, import_node_crypto3.randomUUID)()}.invalid`;
  try {
    await (0, import_promises4.rename)(installDir, invalidDir);
    await (0, import_promises4.rm)(invalidDir, { force: true, recursive: true });
  } catch (error) {
    if (!isErrnoException(error) || error.code !== "ENOENT") throw error;
  }
}
function isDestinationConflict(error) {
  return isErrnoException(error) && (error.code === "EEXIST" || error.code === "ENOTEMPTY" || error.code === "EPERM");
}
function isErrnoException(error) {
  return error instanceof Error && "code" in error;
}

// src/contracts.ts
var import_node_path3 = __toESM(require("node:path"));
var NPM_TARBALL_BASE_URL = "https://registry.npmjs.org/smoque/-";
var VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
var SHA256_PATTERN = /^[a-fA-F0-9]{64}$/u;
function requireVersion(value) {
  const version = value.trim();
  if (!VERSION_PATTERN.test(version)) {
    throw new Error("Invalid version; expected an exact version such as 0.1.2");
  }
  return version;
}
function requireSha256(value) {
  const sha256 = value.trim();
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error("Invalid sha256; expected exactly 64 hexadecimal characters");
  }
  return sha256.toLowerCase();
}
function archiveName(version) {
  return `smoque-${version}.tgz`;
}
function packageUrl(version) {
  return `${NPM_TARBALL_BASE_URL}/${archiveName(version)}`;
}
function cacheDirectory(toolCache, version, sha256) {
  return import_node_path3.default.resolve(toolCache, "smoque", version, sha256);
}
function launcherName(platform = process.platform) {
  return platform === "win32" ? "smoque.cmd" : "smoque";
}

// src/github.ts
var import_node_fs3 = require("node:fs");
var import_node_os = require("node:os");
function input(name, environment = process.env) {
  const value = environment[`INPUT_${name.replaceAll("-", "_").toUpperCase()}`];
  if (!value?.trim()) throw new Error(`Input ${name} is required`);
  return value;
}
function setOutput(name, value, environment = process.env) {
  appendKeyValue(environment.GITHUB_OUTPUT, name, value, "GITHUB_OUTPUT");
}
function addPath(value, environment = process.env) {
  appendLine(environment.GITHUB_PATH, value, "GITHUB_PATH");
}
function appendKeyValue(file, name, value, variable) {
  if (/\r|\n/u.test(name) || /\r|\n/u.test(value)) {
    throw new Error(`Cannot write multiline values to ${variable}`);
  }
  appendLine(file, `${name}=${value}`, variable);
}
function appendLine(file, value, variable) {
  if (!file) throw new Error(`${variable} is not set`);
  if (/\r|\n/u.test(value)) {
    throw new Error(`Cannot write multiline values to ${variable}`);
  }
  (0, import_node_fs3.appendFileSync)(file, `${value}${import_node_os.EOL}`, { encoding: "utf8" });
}
function info(message) {
  process.stdout.write(`${message}${import_node_os.EOL}`);
}
function setFailed(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`::error::${escapeWorkflowCommand(message)}${import_node_os.EOL}`);
  process.exitCode = 1;
}
function escapeWorkflowCommand(message) {
  return message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

// src/install.ts
var import_node_child_process = require("node:child_process");
var import_node_fs4 = require("node:fs");
var import_promises5 = require("node:fs/promises");
var import_node_path4 = __toESM(require("node:path"));
var COMMAND_TIMEOUT_MS = 6e4;
async function installPackage(archive, installRoot, version, runnerTemp, runCommand = run) {
  const npm = resolveNpmInvocation();
  const environment = {
    ...process.env,
    npm_config_cache: import_node_path4.default.join(runnerTemp, "setup-smoque-npm-cache")
  };
  runCommand(
    npm.command,
    [
      ...npm.args,
      "install",
      "--prefix",
      installRoot,
      "--ignore-scripts",
      "--bin-links=false",
      "--no-save",
      "--package-lock=false",
      "--audit=false",
      "--fund=false",
      "--offline",
      archive
    ],
    environment
  );
  const packageRoot = import_node_path4.default.join(installRoot, "node_modules", "smoque");
  const metadata = JSON.parse(
    await (0, import_promises5.readFile)(import_node_path4.default.join(packageRoot, "package.json"), "utf8")
  );
  if (metadata.name !== "smoque" || metadata.version !== version) {
    throw new Error(
      `Installed package identity was ${metadata.name ?? "<missing>"}@${metadata.version ?? "<missing>"}, expected smoque@${version}`
    );
  }
  assertExpectedLauncher(metadata);
  assertNoRuntimeDependencies(metadata);
  const cli = import_node_path4.default.join(packageRoot, "dist", "cli", "main.js");
  await requireRegularFile(cli);
  const versionResult = (0, import_node_child_process.spawnSync)(process.execPath, [cli, "--version"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true
  });
  if (versionResult.error) {
    throw new Error(`Unable to run installed Smoque: ${versionResult.error.message}`);
  }
  if (versionResult.status !== 0 || versionResult.stdout.trim() !== version) {
    throw new Error(`Installed Smoque did not report the expected version ${version}`);
  }
  const { binDirectory, launcherPath } = await createLauncher(installRoot, cli);
  return { binDirectory, launcherPath };
}
function resolveNpmInvocation(platform = process.platform, locateWindowsNpm = locateWindowsNpmCli) {
  if (platform !== "win32") return { args: [], command: "npm" };
  return { args: [locateWindowsNpm()], command: process.execPath };
}
function assertNoRuntimeDependencies(metadata) {
  for (const [field, dependencies] of [
    ["dependencies", metadata.dependencies],
    ["optionalDependencies", metadata.optionalDependencies],
    ["peerDependencies", metadata.peerDependencies]
  ]) {
    if (dependencies && Object.keys(dependencies).length > 0) {
      throw new Error(`smoque declares ${field}; setup-smoque requires a self-contained release`);
    }
  }
}
function assertExpectedLauncher(metadata) {
  const launcher = typeof metadata.bin === "object" && metadata.bin !== null ? metadata.bin.smoque : void 0;
  if (launcher !== "dist/cli/main.js") {
    throw new Error(
      `Installed package bin.smoque was ${launcher ?? "<missing>"}, expected dist/cli/main.js`
    );
  }
}
async function createLauncher(installRoot, cli) {
  const binDirectory = import_node_path4.default.join(installRoot, "bin");
  const launcherPath = import_node_path4.default.join(binDirectory, launcherName());
  await (0, import_promises5.mkdir)(binDirectory);
  if (process.platform === "win32") {
    const node = quoteBatchPath(process.execPath);
    const relativeCli = "%~dp0..\\node_modules\\smoque\\dist\\cli\\main.js";
    await (0, import_promises5.writeFile)(
      launcherPath,
      `@ECHO OFF\r
${node} "${relativeCli}" %*\r
`,
      { encoding: "utf8", flag: "wx", mode: 448 }
    );
    const shellLauncher = import_node_path4.default.join(binDirectory, "smoque");
    await (0, import_promises5.writeFile)(
      shellLauncher,
      '#!/usr/bin/env sh\nexec node "$(dirname "$0")/../node_modules/smoque/dist/cli/main.js" "$@"\n',
      { encoding: "utf8", flag: "wx", mode: 448 }
    );
    await requireRegularFile(shellLauncher);
  } else {
    await (0, import_promises5.symlink)(import_node_path4.default.relative(binDirectory, cli), launcherPath, "file");
    const [resolvedLauncher, resolvedCli] = await Promise.all([
      (0, import_promises5.realpath)(launcherPath),
      (0, import_promises5.realpath)(cli)
    ]);
    if (resolvedLauncher !== resolvedCli) {
      throw new Error("Installed Smoque launcher does not resolve to the verified CLI");
    }
  }
  await requireRegularFile(launcherPath);
  return { binDirectory, launcherPath };
}
function quoteBatchPath(value) {
  if (/\r|\n|"/u.test(value)) throw new Error("Unable to encode the Action Node path");
  return `"${value.replaceAll("%", "%%")}"`;
}
async function requireRegularFile(file) {
  const metadata = await (0, import_promises5.stat)(file);
  if (!metadata.isFile()) throw new Error(`${file} is not a regular file`);
}
function locateWindowsNpmCli() {
  const result = (0, import_node_child_process.spawnSync)("where.exe", ["npm.cmd"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    throw new Error("Unable to locate npm.cmd on the Windows runner PATH");
  }
  for (const command of result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)) {
    const cli = import_node_path4.default.join(import_node_path4.default.dirname(command), "node_modules", "npm", "bin", "npm-cli.js");
    if ((0, import_node_fs4.existsSync)(cli)) return cli;
  }
  throw new Error("Unable to locate npm-cli.js beside npm.cmd on the Windows runner PATH");
}
function run(command, args, environment) {
  const result = (0, import_node_child_process.spawnSync)(command, args, {
    encoding: "utf8",
    env: environment,
    maxBuffer: 16 * 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    windowsHide: true
  });
  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
    throw new Error(`${command} exited with status ${result.status}: ${output}`);
  }
}

// src/action.ts
async function runAction(environment = process.env, overrides = {}) {
  const dependencies = {
    download,
    installPackage,
    publishArchive,
    restoreArchive,
    sha256File,
    ...overrides
  };
  const version = requireVersion(input("version", environment));
  const expectedSha256 = requireSha256(input("sha256", environment));
  const toolCache = environment.RUNNER_TOOL_CACHE ?? environment.RUNNER_TEMP ?? import_node_os2.default.tmpdir();
  const runnerTemp = environment.RUNNER_TEMP ?? import_node_os2.default.tmpdir();
  const cacheDir = cacheDirectory(toolCache, version, expectedSha256);
  const cachedArchive = import_node_path5.default.join(cacheDir, archiveName(version));
  const stagingRoot = import_node_path5.default.resolve(
    runnerTemp,
    "setup-smoque-staging",
    `${version}-${(0, import_node_crypto4.randomUUID)()}`
  );
  const archive = import_node_path5.default.join(stagingRoot, archiveName(version));
  const activationRoot = import_node_path5.default.resolve(
    runnerTemp,
    "setup-smoque-active",
    `${version}-${expectedSha256}-${(0, import_node_crypto4.randomUUID)()}`
  );
  let cacheHit = false;
  try {
    await (0, import_promises6.mkdir)(stagingRoot, { recursive: true });
    cacheHit = await dependencies.restoreArchive(cachedArchive, archive, expectedSha256);
    if (cacheHit) {
      info(`Using verified cached Smoque ${version} tarball`);
    } else {
      info(`Downloading Smoque ${version}`);
      await dependencies.download(packageUrl(version), archive);
      const actualSha256 = await dependencies.sha256File(archive);
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `SHA-256 mismatch for ${archiveName(version)}: expected ${expectedSha256}, received ${actualSha256}`
        );
      }
      await dependencies.publishArchive(archive, cachedArchive, expectedSha256);
    }
    const installation = await dependencies.installPackage(
      archive,
      activationRoot,
      version,
      runnerTemp
    );
    addPath(import_node_path5.default.dirname(process.execPath), environment);
    addPath(installation.binDirectory, environment);
    setOutput("version", version, environment);
    setOutput("sha256", expectedSha256, environment);
    setOutput("path", installation.launcherPath, environment);
    setOutput("cache-hit", String(cacheHit), environment);
    info(`Installed and verified Smoque ${version}`);
    return {
      cacheHit,
      launcherPath: installation.launcherPath,
      sha256: expectedSha256,
      version
    };
  } catch (error) {
    await (0, import_promises6.rm)(activationRoot, { force: true, recursive: true });
    throw error;
  } finally {
    await (0, import_promises6.rm)(stagingRoot, { force: true, recursive: true });
  }
}

// src/index.ts
runAction().catch(setFailed);
