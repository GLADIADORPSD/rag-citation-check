# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
will adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once public releases
begin.

## [Unreleased]

### Added

- Initial TypeScript package bootstrap.
- CI, package smoke tests, contributor documentation, and architecture decision records.
- Public 0.1.0 contracts for inputs, reports, findings, assessments, and typed rejections.
- Defensive hard limits, strict runtime input validation, and source catalog validation.
- Explicit rejection codes for citation-count and quote-size limits.
- Safe handling of the specification's explicit `__proto__` source ID case through `Map`.
- Public `parseInlineCitations` and `checkInlineCitations` functions.
- Linear inline scanner for numeric, named, and mixed citation groups with UTF-16 ranges.
- Declared Markdown exclusions, typed syntax/reference findings, and the F01-F16 fixture corpus.
- Public `checkCitationClaims` for structured claim, reference, coverage, and quote checks.
- Exact and normalized-whitespace quote matching with original-source ranges.
- Explicit quote match results, ambiguity findings, unused-source diagnostics, and F17-F27 fixtures.
- A total quote-count safety limit and typed rejection.
- F28-F32 hardening coverage plus a seeded structured range corpus.
- Reproducible adversarial performance baselines and runtime-boundary verification.
- Exact tarball allowlist checks and immutable GitHub Actions pins.
