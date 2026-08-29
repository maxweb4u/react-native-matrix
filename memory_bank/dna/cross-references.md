---
doc_kind: governance
doc_function: canonical
purpose: Rules for two-way navigation between code and documentation.
derived_from:
  - principles.md
status: active
---

# Cross-references (code ↔ docs)

The goal is two-way navigation: from code to the rule that explains it, and from documentation to the implementation.

## Code → docs

A module implementing documented behaviour carries a comment naming the canonical document, with a path relative to the repository root:

```ts
// See memory_bank/domain/timeline.md#reactions.
```

The annotation states which aspect of the document applies to that module. Modules that only restate obvious mechanics need no link.

## Docs → code

Documentation links to files, and to line ranges only when the reference is stable. Every link is annotated with what is behind it and why to read it.
