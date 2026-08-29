---
doc_kind: adr
doc_function: index
purpose: Index of Architecture Decision Records.
derived_from:
  - ../dna/governance.md
status: active
---

# Architecture Decision Records

One decision per record: context, the decision, and its consequences. A record is never edited after acceptance except to mark it superseded.

- [ADR-001 — Zero runtime dependencies](ADR-001-zero-runtime-dependencies.md) — why the package declares no `dependencies` and pushes native capability to adapters.
- [ADR-002 — Session instance over singleton](ADR-002-session-instance-over-singleton.md) — why `MatrixSession` is instantiated rather than exported as a shared singleton.
- [ADR-003 — Optional E2EE backend](ADR-003-optional-e2ee-backend.md) — why encryption depends on an optional peer package and fails loudly when absent.
- [ADR-004 — Authenticated media only](ADR-004-authenticated-media-only.md) — why every media URL is authenticated and the access token never enters a URL.
- [ADR-005 — Drop the custom REST layer](ADR-005-drop-custom-rest-layer.md) — why all protocol traffic goes through `matrix-js-sdk`.

Use the template at [../flows/templates/adr/adr.md](../flows/templates/adr/adr.md).
