---
doc_kind: engineering
doc_function: index
purpose: Navigation for repository engineering rules.
derived_from:
  - ../dna/governance.md
status: active
audience: humans_and_agents
---

# Engineering Index

- [Architecture](architecture.md) — module boundaries, session ownership, update flow, and the layering contract.
- [Dependency Policy](dependency-policy.md) — the zero-runtime-dependency rule and what qualifies as an exception. Read before adding any package.
- [Adapters](adapters.md) — the platform adapter contracts and wiring recipes for common libraries.
- [Components](components.md) — what the default UI covers, its primitives-only constraint, and the theming and label contracts.
- [TypeScript Conventions](typescript.md) — strictness settings, public type rules, and error classes.
- [Coding Style](coding-style.md) — naming, comments, file layout, and lint rules.
- [Testing Policy](testing-policy.md) — what must be tested, how the suites are split, and how to run them.
- [Git Workflow](git-workflow.md) — branches, commits, and release tags.
- [Gotchas](gotchas.md) — traps in `matrix-js-sdk` and React Native that are easy to hit twice.
