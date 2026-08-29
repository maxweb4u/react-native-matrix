---
doc_kind: governance
doc_function: canonical
purpose: Maintenance rules and sync checklist for governed documents.
derived_from:
  - governance.md
status: active
---

# Document Lifecycle

## Maintenance Rules

1. **Upstream first.** When a fact changes, update its canonical owner before anything else.
2. **Downstream sync.** After changing upstream, check documents that depend on it through `derived_from`.
3. **README sync.** Adding, removing, or renaming a document updates the parent README in the same change.
4. **Conflict is a defect.** Divergence inside the authoritative set is fixed immediately.
5. **Agents report, not silently fix.** An agent that finds divergence while doing unrelated work records it and reports it. It edits the document only when the current task covers it.

## Sync Checklist

- [ ] frontmatter is valid and `derived_from` is set for every non-root `active` document
- [ ] feature packages define `delivery_status`; ADRs define `decision_status`
- [ ] the parent `README.md` reflects the current document set
- [ ] public API changes are reflected in `CHANGELOG.md` and the root `README.md`
