# Security review for 0.1.0

- Review date: 4 September 2026
- Scope: runtime source, public contracts, tests, package contents, CI, and documented guarantees
- Status: no known high- or critical-severity issue at review time

This is a focused maintainer review for the first release candidate. It is not an independent audit
or a guarantee that the package is free of vulnerabilities.

## Assets and untrusted inputs

The review considered process availability, predictable resource use, report integrity, diagnostic
confidentiality, epistemic interpretation, and npm supply-chain integrity. Answers, claims,
citations, source identifiers, source content, quotes, and options are treated as hostile.

## Controls verified

- Runtime validation rejects malformed shapes, unknown options, and work above hard limits.
- UTF-8 byte limits apply to answers, individual source content, aggregate source content, and
  quotes; count limits apply to sources, claims, citations, quotes, and findings.
- Inline parsing uses a state scanner. Runtime source contains no dynamic regular expressions.
- Caller-controlled source IDs are stored in `Map`, including prototype-like identifiers.
- Exact quote matching is literal. Normalized matching performs only NFC and documented whitespace
  normalization and preserves original UTF-16 ranges.
- Normalized sources and repeated source/quote matches are cached within one call.
- Findings do not contain full answers, claim text, quotes, source content, or invalid source IDs.
- Results contain no timestamps or random identifiers and serialize deterministically.
- Production runtime source has no filesystem, network, environment, clock, randomness, timer, or
  process-spawning capability.
- Inputs are not mutated, including frozen arrays and objects used by adversarial tests.
- The package has zero runtime, optional, and peer dependencies.
- Tarball contents are checked against an exact allowlist and installed into isolated ESM and
  CommonJS consumers; internal paths are confirmed to be unavailable through package exports.
- GitHub Actions are pinned to immutable commits, workflows default to `contents: read`, and the
  complete dependency tree is audited in CI.
- Secret-like patterns are rejected by the repository boundary check, and public files were
  reviewed for project scope and unintended private material.

## Adversarial evidence

- Named fixtures F01-F32 cover grammar, references, catalog failures, claim coverage, quote modes,
  Unicode, incomplete input, hard boundaries, and deterministic serialization.
- Seeded corpora exercise 1,000 inline parser inputs and 1,000 structured Unicode/whitespace range
  cases on every test run.
- All public finding and rejection codes have direct test coverage.
- Branch coverage remains above 90%.
- Hard-limit performance scenarios are reproducible through `pnpm benchmark` and recorded in
  [`performance.md`](performance.md).

## Residual risks

- The Markdown scanner deliberately supports a documented subset. Unsupported Markdown or MDX may
  require caller-side extraction or structured mode.
- Native substring-search performance varies by Node.js/V8 version and input distribution. Limits
  bound the requested work but do not guarantee application-specific latency.
- Normalized matching allocates an original-position map. Applications with tighter memory budgets
  should lower source, quote, and count limits.
- A compromised host process can inspect source content and returned reports.
- Literal quote presence can be misleading when evidence is out of context, unauthentic, or
  semantically unrelated. Those dimensions remain `not-assessed`.
- Development dependencies and the CI platform remain external supply-chain components despite
  lockfiles, immutable action pins, and automated audits.

## Re-review triggers

Repeat this review before `1.0.0` and after any change to parsing, normalization, hard limits, public
report semantics, package exports, runtime dependencies, supported Node.js lines, or release
automation.
