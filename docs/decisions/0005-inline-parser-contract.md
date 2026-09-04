# ADR 0005: Inline parser output and range semantics

- Status: Accepted
- Date: 2026-09-04

## Context

The approved specification names `parseInlineCitations` and requires UTF-16 ranges, but does not
define the parse report shape or whether a citation range includes the named-reference `@` marker.
These details must be stable before the parser is exported.

## Decision

`parseInlineCitations` returns the same `completed` or `rejected` operation distinction used by the
check APIs. A completed parse report contains:

- `schemaVersion: "1"`;
- an `outcome` based only on parser error findings;
- ordered citation groups;
- ordered parser findings;
- group, citation, finding, error, and warning counts.

A group range includes its opening and closing brackets. A citation range includes the spelling of
the reference inside the group, including `@` for named references. `sourceId` never includes `@`.
All ranges use JavaScript UTF-16 indices with an inclusive start and exclusive end.

Malformed citation-like markup is a completed parse with `CITATION_MALFORMED`. Invalid runtime
input, invalid options, or a safety-limit violation rejects the operation without a partial report.

The scanner recognizes only the documented citation grammar and declared Markdown exclusions. It
is not a general Markdown abstract syntax tree.

## Consequences

- Consumers can highlight the exact user-visible reference without reconstructing the `@` marker.
- Domain syntax failures remain distinct from operational rejections.
- Future range or report changes require explicit migration treatment.
