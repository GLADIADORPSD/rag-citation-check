# Repository instructions

## Scope

This repository is a public, framework-agnostic TypeScript package for deterministic citation
contract checks in RAG outputs.

## Invariants

- Keep the runtime synchronous, local, and deterministic.
- Keep runtime dependencies at zero unless an ADR is accepted first.
- Never imply that reference or quote checks prove semantic support, trust, authority, or truth.
- Represent unavailable evaluations explicitly as `not-assessed`.
- Treat answers, claims, citations, source IDs, and source content as untrusted input.
- Do not copy private application code, private architecture, prompts, policies, data, or secrets.
- Do not change public contracts or architecture without an ADR and maintainer approval.

## Quality gate

Run `pnpm check` before proposing a change. Every bug fix needs a regression test. Security and
parser changes also need adversarial coverage.

## Code style

Use strict TypeScript, small functions, explicit types at public boundaries, and comments only for
decisions, risks, invariants, or counterintuitive behavior.
