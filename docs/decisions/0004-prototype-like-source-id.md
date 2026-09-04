# ADR 0004: Preserve the explicit `__proto__` source ID case

- Status: Accepted
- Date: 2026-09-04

## Context

The approved specification describes source IDs with an alphanumeric first character, but also
declares `__proto__` syntactically valid and requires it in the security corpus. The explicit case
exists to demonstrate that source lookup uses `Map` and cannot assign through object prototypes.

Allowing every identifier that starts with an underscore would broaden the grammar beyond either
stated requirement. Rejecting `__proto__` would remove the intended prototype-pollution regression
case.

## Decision

Treat `__proto__` as one explicit valid exception to the otherwise unchanged source ID pattern.
`constructor` and `prototype` already satisfy the general pattern. Other leading-underscore IDs
remain invalid.

## Consequences

- The mandatory prototype-pollution case remains a real catalog entry rather than only malformed
  input.
- The general public grammar is not silently widened.
- A future grammar change must update the parser, catalog validator, documentation, and fixtures
  together.
