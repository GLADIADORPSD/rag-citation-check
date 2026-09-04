# ADR 0002: Package baseline

- Status: Accepted
- Date: 2026-09-04

## Context

The first release needs modern TypeScript, strict validation, broad Node.js usability, reproducible
tooling, and a package shape that can be consumed by both ESM and CommonJS applications.

## Decision

- Maintain one package rather than a monorepo.
- Require Node.js 22.13 or newer and test the maintained Node.js 22 and 24 LTS lines.
- Use pnpm 11.19.0 and TypeScript 6.0.3.
- Build ESM, CommonJS, source maps, and TypeScript declarations from one source tree.
- Keep runtime dependencies at zero.
- Allow installation scripts only for `esbuild`, the platform-specific build binary used by the
  selected build and test toolchain.
- Suppress TypeScript 6 deprecation diagnostics because the declaration bundler currently supplies
  deprecated `baseUrl` internally; this does not relax type checking and must be revisited before a
  TypeScript 7 upgrade.
- Keep `private: true` and version `0.0.0` until the first release is deliberately prepared.
- Test the packed tarball in isolated ESM and CommonJS consumers.

## Consequences

- CommonJS support adds packaging checks but avoids excluding common Node.js backends.
- Development dependencies remain reviewable and locked even though runtime dependencies are zero.
- Publishing cannot happen accidentally during the bootstrap phase.
