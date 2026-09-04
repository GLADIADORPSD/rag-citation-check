# rag-citation-check

[![CI](https://github.com/GLADIADORPSD/rag-citation-check/actions/workflows/ci.yml/badge.svg)](https://github.com/GLADIADORPSD/rag-citation-check/actions/workflows/ci.yml)

A small, deterministic TypeScript library for checking citation contracts in RAG outputs —
without calling another LLM.

> [!IMPORTANT]
> The project is in its bootstrap phase and is not published to npm yet. Its validation API is
> specified but not implemented.

## Why this project

A citation can be syntactically valid while still pointing to an unknown source. A cited quote can
exist in the supplied source while still not supporting the model's claim. Those are different
properties and should not be collapsed into a single `grounded: true` flag.

`rag-citation-check` is designed to report each property independently:

| Assessment         | Question                                                      |
| ------------------ | ------------------------------------------------------------- |
| `citationSyntax`   | Does the citation follow the declared grammar?                |
| `sourceReference`  | Does it reference a supplied source ID?                       |
| `citationCoverage` | Does a claim marked as requiring citations have one?          |
| `quotePresence`    | Does the declared quote occur in the supplied source?         |
| `semanticSupport`  | Does the source semantically support the claim? Not assessed. |
| `sourceTrust`      | Is the source trustworthy or authoritative? Not assessed.     |
| `factualTruth`     | Is the answer factually true? Not assessed.                   |

The planned result states are `verified`, `failed`, and `not-assessed`. A global `pass` will only
mean that the deterministic checks requested by the caller completed without an error finding.

## Planned scope for 0.1.0

- Inline citations such as `[1]`, `[1, 2]`, and `[@source-id]`.
- Structured claims with explicit source IDs and optional quotes.
- Stable, typed findings with source and answer ranges.
- Exact and conservative whitespace-normalized quote matching.
- Explicit input limits and deterministic output ordering.
- Zero runtime dependencies and no network access.

## Non-goals

The package will not:

- call an LLM or embedding model;
- claim to detect hallucinations or factual errors;
- judge semantic entailment, retrieval quality, source trust, or authority;
- fetch URLs, resolve DOIs, repair answers, or generate citations;
- require a RAG framework, database, server, or observability platform.

## Development

Requirements:

- Node.js 22.13 or newer;
- pnpm 11.19.0 through Corepack.

```bash
corepack enable
pnpm install
pnpm check
```

`pnpm check` formats, lints, type-checks, tests, builds both module formats, creates the package
tarball, installs it into isolated ESM and CommonJS consumers, and imports both entrypoints.

## Project status

The current repository contains only the verified package bootstrap. Functional work will be added
in reviewable slices after its contracts and failure corpus are approved.

Architecture decisions live in [`docs/decisions`](docs/decisions). Contributions should follow
[`CONTRIBUTING.md`](CONTRIBUTING.md), and security reports should follow
[`SECURITY.md`](SECURITY.md).

## AI-assisted development

AI tools may assist with research, implementation, tests, and documentation. Every public change
must still be reviewed for architecture, correctness, security, scope, and maintainer
understanding. Generated code is not accepted merely because it compiles or passes tests.

## License

MIT © Pedro Duarte.
