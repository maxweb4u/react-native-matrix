---
doc_kind: governance
doc_function: canonical
purpose: Foundational principles of project documentation. Root document of the dependency tree.
status: active
---

# Principles

1. **SSoT.** Every fact has exactly one canonical owner. Duplicates are defects.
2. **Atomicity.** One file equals one topic. If it grows, split it.
3. **Compactness.** A document must stay readable end to end.
4. **Progressive disclosure.** Overview first, then deeper links.
5. **WHY / WHAT / HOW.** `adr/` = why, `features/` = what, code = how.
6. **Code vs docs.** Code owns implementation. Documentation owns intent, rationale, and contracts.
7. **Index-first.** Every document is reachable from an index. An orphan file is a defect.
8. **Annotated links.** A link states what it points to and why to read it.
9. Every architecture decision is a separate ADR.
10. **Proportionate governance.** This is a small library maintained by a small team. Add a rule only when a realistic mistake or a public contract justifies it; otherwise prefer the simplest rule.
11. **Public contract discipline.** Anything exported from `src/index.ts` is a published API. Changing it requires a changelog entry and, when breaking, a major version.
