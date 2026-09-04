# ADR 0006: Quote match results and operation limit

- Status: Accepted
- Date: 2026-09-04

## Context

The approved 0.1.0 specification requires exact and normalized-whitespace quote checks, including
the range in the original source when a match is unique. The conceptual report did not provide a
place for a successful range. Emitting a success as a finding would blur diagnostics with results
and consume the finding budget during successful calls.

The specification also requires quote matching to be limited by size and quantity. It defines a
per-quote byte limit but omits a total quote-count limit, allowing a structurally valid call to
request an impractical number of searches.

## Decision

`CitationCheckReport` contains `quoteMatches`. Each entry identifies its input path and includes a
source ID only when that ID satisfies the public identifier contract. A unique match exposes its
original UTF-16 `sourceRange`; a multiple match sets
`ambiguous: true` and deliberately omits a range. Failed checks remain findings and do not produce a
match entry. Inline reports use an empty array because inline citations do not declare quotes.

`CitationCheckOptions.quoteMatching` selects `exact` or `normalized-whitespace`; `exact` is the
default. The source is normalized at most once per call and source ID. Normalized positions map back
to the original content.

`CitationCheckLimits.quoteCount` limits the total number of declared quotes to 10,000 by default and
as a hard maximum. Exceeding it rejects the operation with `QUOTE_COUNT_LIMIT_EXCEEDED` before quote
matching begins. Callers may lower the limit like every other safety limit.

## Consequences

- Successful evidence locations are machine-readable without synthetic success findings.
- Ambiguity cannot be mistaken for a selected canonical occurrence.
- Structured checks have a deterministic upper bound on the number of requested quote searches.
- Adding report data and a rejection code changes the pre-release contract and is documented before
  implementation.
