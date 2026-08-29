---
doc_kind: governance
doc_function: canonical
purpose: Schema of required and optional YAML frontmatter fields.
derived_from:
  - governance.md
status: active
---

# Frontmatter Schema

## Required

| Field | Type | Description |
|---|---|---|
| `status` | enum | `draft` / `active` / `archived` |
| `purpose` | string | One sentence: what the document is for |

## Optional

| Field | When | Description |
|---|---|---|
| `derived_from` | An upstream document exists | Direct upstream dependencies. Each entry is a path, or `{path, fit}` where `fit` narrows the dependency |
| `delivery_status` | Feature packages | `planned` / `in_progress` / `done` / `cancelled` |
| `decision_status` | ADR documents | `proposed` / `accepted` / `superseded` / `rejected` |
| `audience` | Any | `humans_and_agents` by default |

## Example

```yaml
---
doc_kind: engineering
doc_function: canonical
purpose: Rules for adding runtime dependencies.
derived_from:
  - ../dna/governance.md
status: active
canonical_for:
  - runtime_dependency_policy
---
```
