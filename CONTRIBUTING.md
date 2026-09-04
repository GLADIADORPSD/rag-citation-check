# Contributing

Thanks for helping improve `rag-citation-check`.

## Before opening a change

- Keep the package focused on deterministic citation-contract validation.
- Do not add network calls, model calls, framework coupling, or runtime dependencies without an
  accepted architecture decision record.
- Do not describe structural checks as truth, hallucination detection, source trust, or semantic
  support.
- Never commit secrets, private prompts, proprietary application code, production data, or private
  architecture documents.
- Add a regression fixture before fixing a confirmed parser, classification, or security bug.

## Local workflow

```bash
corepack enable
pnpm install
pnpm check
```

Use a focused branch and open a pull request. The pull request should explain the user-visible
contract, security implications, tests, and any documentation changes.

## Architecture decisions

Changes to public semantics, package boundaries, supported runtimes, dependencies, parsers, or
security guarantees require an ADR under `docs/decisions` before implementation.

## Comments

Comments are welcome when they explain decisions, risks, invariants, or counterintuitive behavior.
Avoid comments that merely restate the code.
