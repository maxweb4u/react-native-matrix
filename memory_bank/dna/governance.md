---
doc_kind: governance
doc_function: canonical
purpose: SSoT implementation and dependency tree rules. Answers which fact is owned by whom.
derived_from:
  - principles.md
status: active
---

# Document Governance

A governed document is a Markdown file in `memory_bank/` with valid YAML frontmatter. The SSoT principle is defined in [principles.md](principles.md); this document describes how it is enforced.

## SSoT Implementation

1. Only `active` documents are authoritative. `draft` does not override `active`.
2. Among documents allowed by status, upstream wins: first `canonical_for`, then the dependency tree.
3. Publication status (`status`) is separate from entity lifecycle status (`delivery_status`, `decision_status`).

## Document Language

All documents in `memory_bank/` are written in English, including frontmatter values, headings, tables, and examples. This matches the language of the code, the public README, and the npm audience.

## Source Dependency Tree

1. `derived_from` lists direct upstream documents. Authority flows upstream → downstream.
2. The root document is `principles.md`; it has no `derived_from`. Every other `active` document defines one.
3. Cycles are forbidden. Upstream changes may require downstream updates.

## Governance-specific Frontmatter Fields

| Field | Values | Purpose |
|-|-|-|
| `doc_kind` | `governance`, `project`, `product`, `domain`, `feature`, `engineering`, `ops`, `adr` | Knowledge layer the document belongs to |
| `doc_function` | `canonical`, `index`, `template` | Role: canonical owner of a fact, navigation index, or template |
| `canonical_for` | list of fact keys | Facts this document owns outright |
| `must_not_define` | list of fact keys | Facts this document must never restate |

These fields are required for governance documents and recommended elsewhere.
