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
| 6 | Components on React Native primitives | done |
| 7 | Adapter contracts and defaults | done |
| 8 | Optional E2EE module | done |
| 9 | Synapse in Docker and the integration suite | done |
| 10 | `example/` application | done |
| 11 | Documentation, changelog, npm release | done |

All eleven stages are closed. `0.2.0` was published to npm on 2026-08-30 and
tagged `v0.2.0` on `master`, which is the first time the rewrite reached a
consumer: the registry served `0.0.12`, published in 2022, until that day. The
checklist each release is worked through is
[../ops/release.md](../ops/release.md).

## 0.2.0 — trust and cold start

Mostly not new surface. It closes what 0.1.0 left open: a failure that could
not be read, a peer range nothing tested, an example that broke its own rule,
and the sync-token persistence below — the one item from this list that a user
feels. Stages 6 and 7 were built after the rest and released with it rather
than held back, because neither changes existing behaviour. Tracked in
[../backlog.md](../backlog.md#closed-by-020).

| Stage | Content | State |
|-|-|-|
| 1 | Named host-requirement failure, in place of a raw `TypeError` | done |
| 2 | Peer floors raised to what is tested | done |
| 3 | `data:` uploads, and the example's encryption toggle | done |
| 4 | Regression tests for the audit's sort defect, and a coverage floor | done |
| 5 | Persistent sync so a relaunch is not a full initial sync | done |
| 6 | Push helpers: pusher, notification levels, payload resolution | done |
| 7 | The React hooks and `TypingIndicator` covered, from 0% | done |

The rules for stage 6 are in [../domain/push.md](../domain/push.md); it is
added surface, so it shipped on a minor bump with no caveat.

## 0.3.0 — threads

Deferred here deliberately on 2026-08-29 rather than squeezed into 0.2.0,
because turning threads on is not additive. `createClient` runs without
`threadSupport`, which the SDK defaults to `false`, and setting it moves thread
replies out of the main live timeline, changes read receipts to the threaded
form, and splits the unread count into a room count plus a per-thread count.
All three are visible to a consumer, so they belong in a release of their own
with their own integration tests rather than alongside unrelated work. The
scope is in [../backlog.md](../backlog.md#deferred-to-030).

## Not planned

- Spaces are **not** planned, whatever this list said before: [context.md](context.md)
  makes them a non-goal, and a roadmap entry contradicting the product's own
  non-goals is how scope arrives unnoticed. It moves only if that decision is
  reversed there first.
