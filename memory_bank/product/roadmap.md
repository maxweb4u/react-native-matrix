---
doc_kind: product
doc_function: canonical
purpose: Ordered delivery plan for the rewrite and the work that follows it.
derived_from:
  - vision.md
status: active
canonical_for:
  - delivery_order
---

# Roadmap

## 0.1.0 — TypeScript rewrite

Tracked as [FT-001](../features/FT-001-typescript-rewrite/feature.md).

| Stage | Content | State |
|-|-|-|
| 1 | Package scaffold: TypeScript, ESLint, Jest, build pipeline | done |
| 2 | Memory bank | done |
| 3 | Core: session, mxc/media, errors, utils | done |
| 4 | Timeline: parsing, store, reactions, edits, redactions | done |
| 5 | React layer: provider and hooks | done |
| 6 | Components on React Native primitives | planned |
| 7 | Adapter contracts and defaults | planned |
| 8 | Optional E2EE module | planned |
| 9 | Synapse in Docker and the integration suite | planned |
| 10 | `example/` application | planned |
| 11 | Documentation, changelog, npm release | planned |

## After 0.1.0

- Threads as a first-class UI, not just a timeline relation.
- Local persistence of the sync token so cold start is not a full initial sync.
- Push notification helpers around the pusher API.
- Spaces, if consumers ask for them.
