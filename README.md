# rag-citation-check

[![CI](https://github.com/GLADIADORPSD/rag-citation-check/actions/workflows/ci.yml/badge.svg)](https://github.com/GLADIADORPSD/rag-citation-check/actions/workflows/ci.yml)

A small, deterministic TypeScript library for checking citation contracts in RAG outputs —
without calling another LLM.

> [!IMPORTANT]
> The package is preparing its first release candidate and is not published to npm yet. Its API may
> still change before `1.0.0`.

After the first release is published:

```bash
pnpm add rag-citation-check
```

## Why

A citation can be syntactically correct while pointing to an unknown source. A quoted passage can
exist in that source while failing to support the model's interpretation. Those are separate claims
and should not be collapsed into `grounded: true`.

`rag-citation-check` reports only what deterministic local checks establish and marks everything
else as `not-assessed`.

## Quickstart

```ts
import { checkInlineCitations } from 'rag-citation-check';

const result = checkInlineCitations({
  answer: 'Refunds are available within 30 days [@refund-policy].',
  sources: [{ id: 'refund-policy' }],
});

if (result.kind === 'completed') {
  console.log(result.report.outcome); // "pass"
  console.log(result.report.assessments.sourceReference); // "verified"
}
```

`verified` here means only that the parsed reference exists in the supplied catalog. It does not
establish semantic support, source trust, authority, authenticity, or factual truth.

## Result semantics

Every check returns a discriminated result:

- `completed`: the operation ran completely. Citation errors appear as findings and set
  `report.outcome` to `fail`.
- `rejected`: invalid runtime input, invalid options, or a safety limit prevented a complete check.
  No partial report is returned.

Each assessment is independent:

| Assessment         | Question                                                    | Inline         | Structured                |
| ------------------ | ----------------------------------------------------------- | -------------- | ------------------------- |
| `sourceCatalog`    | Are source IDs valid and unique?                            | checked        | checked                   |
| `citationSyntax`   | Do recognized inline citations follow the grammar?          | checked        | `not-assessed`            |
| `sourceReference`  | Does every recognized reference name a supplied source?     | checked        | checked                   |
| `citationCoverage` | Does every claim marked `citationRequired` have a citation? | `not-assessed` | checked                   |
| `quotePresence`    | Does every declared quote occur in its source?              | `not-assessed` | checked when quotes exist |
| `semanticSupport`  | Does the evidence entail the claim?                         | `not-assessed` | `not-assessed`            |
| `sourceTrust`      | Is the source trustworthy or authoritative?                 | `not-assessed` | `not-assessed`            |
| `factualTruth`     | Is the answer true?                                         | `not-assessed` | `not-assessed`            |

An applicable assessment is `verified` when every corresponding check succeeds and `failed` when
at least one fails. A global `pass` means only that the deterministic rules applicable to that call
produced no error finding.

## Structured claims and quotes

Use structured mode when the pipeline already emits explicit claims and references:

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

The default quote mode is `exact`: case, punctuation, whitespace, and code points must match.

Opt into conservative whitespace normalization when formatting differences are expected:

```ts
checkCitationClaims(input, { quoteMatching: 'normalized-whitespace' });
```

This mode applies Unicode NFC, converts whitespace runs to one ASCII space, and trims boundaries.
It deliberately does not fold case, remove accents or punctuation, perform fuzzy matching, or
measure semantic similarity.

Unique matches expose their original UTF-16 `sourceRange` in `report.quoteMatches`. Multiple
occurrences produce `QUOTE_MATCH_AMBIGUOUS`, confirm presence, and omit a selected range.

## Inline grammar

The parser recognizes:

- numeric references: `[1]`, `[1, 2]`;
- named references: `[@policy-refunds]`, `[@doc-a, @doc-b]`;
- mixed groups: `[1, @doc-b]`.

Source IDs are case-sensitive ASCII identifiers of 1–64 characters. Named inline references use
`@`, but `@` is not part of the source ID.

The scanner ignores code spans, fenced code blocks, escaped brackets, Markdown links and images,
footnotes, and ordinary named brackets such as `[draft]`. Citation-like tokens that begin in the
canonical grammar but do not finish it produce `CITATION_MALFORMED`.

This is intentionally not a complete Markdown or MDX parser.

To parse without checking a source catalog:

```ts
import { parseInlineCitations } from 'rag-citation-check';

const parsed = parseInlineCitations('Result [1, @doc-a].');
```

Ranges use JavaScript UTF-16 indices with an inclusive start and exclusive end.

## Findings

Consumers should branch on `code`, not on the human-readable message.

| Code                          | Severity | Meaning                                       |
| ----------------------------- | -------- | --------------------------------------------- |
| `SOURCE_ID_INVALID`           | error    | Source ID violates the public grammar.        |
| `SOURCE_ID_DUPLICATE`         | error    | A source ID is declared more than once.       |
| `CITATION_MALFORMED`          | error    | Citation-like markup is malformed.            |
| `CITATION_SOURCE_UNKNOWN`     | error    | A citation references an absent source.       |
| `CITATION_DUPLICATE_IN_GROUP` | warning  | One group repeats a source ID.                |
| `CLAIM_CITATION_REQUIRED`     | error    | A required structured claim has no citation.  |
| `QUOTE_EMPTY`                 | error    | A declared quote is empty or whitespace-only. |
| `SOURCE_CONTENT_MISSING`      | error    | Quote checking lacks source content.          |
| `QUOTE_NOT_FOUND`             | error    | The quote is absent under the selected mode.  |
| `QUOTE_MATCH_AMBIGUOUS`       | warning  | The quote occurs more than once.              |
| `SOURCE_UNUSED`               | info     | A supplied source is never referenced.        |

Findings never include full answers, quotes, or source content.

## Defensive limits

Defaults are also hard maxima in `0.1.x`. Callers may lower them through `options.limits`.

| Input                               |               Limit |
| ----------------------------------- | ------------------: |
| Answer                              |       128 KiB UTF-8 |
| Sources                             |                 500 |
| Content per source                  |         1 MiB UTF-8 |
| Total source content                |         8 MiB UTF-8 |
| Structured claims                   |               5,000 |
| Citations per claim or inline group |                 100 |
| Declared quotes per operation       |              10,000 |
| Quote                               |        64 KiB UTF-8 |
| Findings                            |              10,000 |
| Source ID                           | 64 ASCII characters |

Limit violations return `kind: 'rejected'` with a stable typed code, path, limit, and observed
amount. The exported `HARD_LIMITS` constant provides the complete programmatic contract.

## Using reports in CI

```ts
const result = checkCitationClaims(fixture);

if (result.kind === 'rejected') {
  throw new Error(`Citation check rejected: ${result.error.code}`);
}

if (result.report.outcome === 'fail') {
  throw new Error(result.report.findings.map(({ code, path }) => `${code} ${path}`).join('\n'));
}
```

## Security and determinism

The runtime is synchronous, local, and deterministic. It has zero runtime dependencies and does not
access the network, filesystem, clock, randomness, environment variables, or models. Source lookup
uses `Map`; regular expressions are fixed rather than constructed from input; normalization caches
each source once per call; and byte, count, quote, and finding work is bounded.

The same package version, input, and options produce the same serialized result. Inputs are not
mutated, and diagnostics avoid echoing hostile content.

See [`SECURITY.md`](SECURITY.md) for reporting and threat boundaries and
[`docs/security-review-0.1.0.md`](docs/security-review-0.1.0.md) for the release-candidate review.
Reproducible local baselines live in [`docs/performance.md`](docs/performance.md).

## Non-goals

The package does not:

- detect hallucinations or factual errors;
- judge entailment, source quality, trust, authority, or authenticity;
- detect prompt injection or authorize tool calls;
- fetch URLs, resolve DOIs, repair answers, or generate citations;
- call an LLM, embedding model, reranker, or remote service;
- require a RAG framework, database, server, or telemetry system.

## Compatibility and package shape

- Node.js 22.13 or newer;
- strict TypeScript declarations;
- explicit ESM and CommonJS exports;
- `sideEffects: false`;
- zero runtime dependencies;
- package internals are not exported.

The release tarball is allowlisted and smoke-tested by installing it into isolated ESM and CommonJS
consumers.

## Development

```bash
corepack enable
pnpm install
pnpm check
```

`pnpm check` verifies formatting, lint, strict types, runtime boundaries, tests and coverage, both
module builds, exact tarball contents, and isolated package imports. Parser, normalization, limits,
or output-volume changes should also run `pnpm benchmark`.

Architecture decisions live in [`docs/decisions`](docs/decisions). See
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before proposing a
change.

## AI-assisted development

AI tools may assist with research, implementation, tests, and documentation. Every public change
must still be reviewed for architecture, correctness, security, scope, and maintainer understanding.
Generated code is not accepted merely because it compiles or passes tests.

## License

MIT © Pedro Duarte.
