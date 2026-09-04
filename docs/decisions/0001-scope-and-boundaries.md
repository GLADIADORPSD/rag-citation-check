# ADR 0001: Scope and epistemic boundaries

- Status: Accepted
- Date: 2026-09-04

## Context

Existing citation utilities often compare cited IDs with retrieved IDs. That check is useful, but a
single boolean can encourage callers to infer that a claim is grounded or true. Citation syntax,
source reference, quote presence, semantic support, source trust, and factual truth are different
properties.

## Decision

`rag-citation-check` will be a deterministic citation-contract validator. It will report independent
assessments using `verified`, `failed`, and `not-assessed`.

Version 0.1.0 may check citation grammar, source references, declared coverage, and quote presence.
It will not evaluate semantic support, source trust, authority, retrieval quality, or factual truth.

The runtime will not call an LLM, access the network, fetch sources, or depend on a RAG framework.

## Consequences

- Results remain reproducible and inexpensive.
- The API must carry more information than a convenient `grounded` boolean.
- Documentation and finding names must remain narrow and claim-scoped.
- Semantic evaluation can only be added as a separate future layer with a new ADR.
