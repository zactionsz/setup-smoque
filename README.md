# setup-smoque

Install an exact Smoque release for a GitHub Actions job without adding
Smoque, a `package.json`, or a lockfile to the consumer repository.

The Action only installs Smoque. The workflow owns test discovery, selection,
reporting, and every other Smoque operation.

```yaml
steps:
  - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5

  - uses: zactionsz/setup-smoque@af5e0479c60a7c9957e0da2de8311f030c0f9871
    with:
      version: "0.1.2"
      sha256: "f6644336d7104c8099c42824a28dacdf402fcfe8b7a487fefc09b00b3b58d45d"

  - run: smoque run smoke/ --ci
```

The SHA-256 input is for the exact npm tarball at
`https://registry.npmjs.org/smoque/-/smoque-<version>.tgz`. The Action verifies
the bytes before installing with lifecycle scripts disabled. It rejects a
release that declares runtime dependencies so the same version and digest stay
a complete installation identity.

## Outputs

- `version`: verified Smoque version
- `sha256`: verified lowercase tarball digest
- `path`: absolute path to the installed launcher
- `cache-hit`: `true` when the verified tarball was already in the runner tool cache

## Requirements

The Action supports GitHub-hosted Linux, macOS, and Windows runners. It uses the
Node 24 runtime bundled with the Actions runner for both setup and the installed
Smoque command.

## Development

```sh
npm ci
npm run check
```

`dist/index.js` is committed because GitHub executes the bundle rather than the
TypeScript source.
