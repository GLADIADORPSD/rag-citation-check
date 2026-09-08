# Maintainer review for 0.1.0

This guide is a release gate. Passing tests is necessary, but the release must not proceed until the
maintainer can explain and defend the public contract and the implementation choices below.

## Public contract

Confirm that you can explain:

- why `parseInlineCitations`, `checkInlineCitations`, and `checkCitationClaims` are the only runtime
  exports;
- the difference between `completed` with a failing report and `rejected` without a partial report;
- why assessment dimensions remain independent and why semantic support, source trust, and factual
  truth are always `not-assessed`;
- the stability expectations for finding codes, rejection codes, paths, severities, and UTF-16
  ranges.

## Inline parser

Review the scanner from input validation through report construction. Be able to describe:

- the supported numeric, named, and mixed citation grammar;
- why Markdown links, images, code, footnotes, escaped brackets, and ordinary named brackets are
  excluded;
- how malformed citation-like input differs from text that is intentionally ignored;
- how the implementation bounds citations, findings, byte work, and incomplete groups without
  becoming a full Markdown parser.

## Structured quotes and ranges

Trace at least one exact and one normalized-whitespace match. Be able to describe:

- the deliberately conservative normalization pipeline: Unicode NFC, whitespace collapse, and
  boundary trimming;
- why case, accents, punctuation, fuzzy similarity, and semantic entailment are not normalized;
- how normalized UTF-16 positions map back to the original source range;
- why multiple matches confirm presence but produce an ambiguity warning without choosing a range;
- how source normalization and repeated source/quote results are cached within one call.

## Validation, limits, and determinism

Review every exported hard limit and at least one rejection path. Confirm that you understand:

- why untrusted identifiers use `Map` and why invalid values are not echoed in diagnostics;
- why byte, source, claim, citation, quote, and finding ceilings are hard maxima in `0.1.x`;
- why the runtime has no network, filesystem, environment, clock, randomness, timer, or dynamic
  regular-expression capability;
- how stable ordering, absence of timestamps, and non-mutation support deterministic serialization.

## Package and security boundary

Inspect the generated tarball and both module entrypoints. Confirm that you can explain:

- the conditional ESM/CommonJS export and declaration layout;
- why package internals are not exported and why the tarball uses an exact allowlist;
- the zero-runtime-dependency policy and the remaining development/CI supply-chain risk;
- the threat model and residual risks in `security-review-0.1.0.md`.

## Sign-off

Before approving the release-candidate PR, record review notes in the PR and confirm that:

- [ ] every section above was reviewed against the implementation;
- [ ] unclear code was rewritten or documented before approval;
- [ ] the tarball was exercised in a real consuming application;
- [ ] the npm name, owner account, access level, and release tag were confirmed;
- [ ] no package, Git tag, or GitHub release was created before explicit approval.
