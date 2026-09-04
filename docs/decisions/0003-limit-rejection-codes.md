# ADR 0003: Complete the limit rejection vocabulary

- Status: Accepted
- Date: 2026-09-04

## Context

The approved 0.1.0 specification sets hard limits for citations per structured claim and quote
content, but its rejection table does not assign a code to either excess. Mapping them to
`INPUT_INVALID` would hide a safety-limit decision as a shape error, while leaving them unchecked
would make the documented limits ineffective.

## Decision

Add two public rejection codes:

- `CITATION_COUNT_LIMIT_EXCEEDED` for a claim whose citation array exceeds its configured limit;
- `QUOTE_LIMIT_EXCEEDED` for a quote whose UTF-8 byte length exceeds its configured limit.

Like the other limit rejections, both include only a stable path and numeric `limit` and `actual`
values. They do not echo answer, source, claim, or quote content.

## Consequences

- Every configurable 0.1.0 collection or byte-size limit has an explicit outcome.
- Callers can distinguish invalid shapes from resource-bound rejections.
- The two codes become part of the public pre-1.0 contract and require changelog treatment if they
  change.
