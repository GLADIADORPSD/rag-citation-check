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
