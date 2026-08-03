---
doc_kind: governance
doc_function: canonical
purpose: Definitions of governance terms used across the memory bank.
derived_from:
  - principles.md
status: active
---

# Memory Bank Glossary

| Term | Definition |
|-|-|
| Governed document | A Markdown file under `memory_bank/` with valid frontmatter |
| Canonical owner | The single document that defines a given fact |
| Feature package | A directory under `features/` holding the intent and plan for one delivery unit |
| ADR | Architecture Decision Record: one decision, its context, and its consequences |
| Adapter | A host-supplied implementation of a platform capability the library does not depend on directly |
| Public contract | Anything exported from `src/index.ts`, plus the adapter interfaces |
