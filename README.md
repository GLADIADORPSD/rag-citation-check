# rag-citation-check

[![CI](https://github.com/GLADIADORPSD/rag-citation-check/actions/workflows/ci.yml/badge.svg)](https://github.com/GLADIADORPSD/rag-citation-check/actions/workflows/ci.yml)

A small, deterministic TypeScript library for checking citation contracts in RAG outputs —
without calling another LLM.

> [!IMPORTANT]
> The project is under pre-release development and is not published to npm yet. Inline and
> structured citation checks are implemented; release hardening is still in progress.

## Quickstart

```ts
import { checkInlineCitations } from 'rag-citation-check';

const result = checkInlineCitations({
  answer: 'Refunds are available within 30 days [@refund-policy].',
  sources: [{ id: 'refund-policy' }],
});

if (result.kind === 'completed') {
  console.log(result.report.assessments.sourceReference); // "verified"
}
```

`verified` above means only that the parsed citation references an ID present in the supplied
catalog. It does not establish semantic support, source trust, authority, or factual truth.

Structured pipelines can also verify declared quote presence without another model call:

```ts
import { checkCitationClaims } from 'rag-citation-check';

const result = checkCitationClaims({
  claims: [
    {
      id: 'refund-window',
      text: 'Refunds are available within 30 days.',
      citationRequired: true,
      citations: [{ sourceId: 'policy', quote: 'within 30 days' }],
    },
  ],
  sources: [{ id: 'policy', content: 'Requests must be submitted within 30 days.' }],
});
```

The default quote mode is exact. Pass `{ quoteMatching: 'normalized-whitespace' }` to normalize NFC,
line endings, and whitespace runs. This mode remains case-, accent-, and punctuation-sensitive.
Unique successful matches expose their original UTF-16 range in `report.quoteMatches`; ambiguous
matches produce `QUOTE_MATCH_AMBIGUOUS` and intentionally omit a selected range.

## Inline citation grammar

The parser recognizes numeric references (`[1]`), named references (`[@doc-a]`), and groups
(`[1, 2]`, `[@doc-a, @doc-b]`, or mixed forms). Named IDs require `@`; ordinary brackets such as
`[draft]` are ignored.

Citation-like markup inside inline code, fenced code blocks, Markdown link text, images, footnotes,
or escaped brackets is ignored. The scanner is deliberately not a complete Markdown parser.

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

The repository contains the verified package bootstrap, contract-validation foundations, inline
parser/checker, and structured claim/quote checker. Release hardening, benchmarks, and the complete
documentation pass remain before the first release candidate.

Architecture decisions live in [`docs/decisions`](docs/decisions). Contributions should follow
[`CONTRIBUTING.md`](CONTRIBUTING.md), and security reports should follow
[`SECURITY.md`](SECURITY.md).

## AI-assisted development

AI tools may assist with research, implementation, tests, and documentation. Every public change
must still be reviewed for architecture, correctness, security, scope, and maintainer
understanding. Generated code is not accepted merely because it compiles or passes tests.

## License

MIT © Pedro Duarte.
