---
doc_kind: engineering
doc_function: canonical
purpose: What must be tested, how the suites are split, and how to run them.
derived_from:
  - ../dna/governance.md
status: active
canonical_for:
  - test_suite_split
  - required_coverage
  - test_commands
---

# Testing Policy

## Stack

Jest with the `react-native` preset, `@testing-library/react-native` for components and hooks, and a real Synapse in Docker for integration tests. No mocking framework beyond Jest itself.

## Suite split

| Suite | Location | Runs against | Command |
|-|-|-|-|
| unit | `src/**/__tests__/` | Nothing external; fake timers | `npm test` |
| integration | `integration/` | Local Synapse, real timers | `npm run test:integration` |

The split is enforced by Jest projects, so `npm test` never needs a network or Docker. Integration tests are the only place a real homeserver is contacted.

## Required coverage

- Every behaviour change that can be verified deterministically gets an automated test.
- Every bug fixed gets a regression test naming the original defect in a comment. The rewrite carries defects forward from 0.0.x this way, so they cannot return unnoticed.
- Every public contract — exported functions, hook return shapes, adapter interfaces — is exercised.
- Hostile input is tested explicitly wherever remote data is parsed. See [../domain/timeline.md](../domain/timeline.md#content-parsing).
- Percentage coverage is not a target. Scenario coverage is.

## What integration tests own

Behaviour that only a real homeserver can prove: login and sync, send and receive across two users, media upload and authenticated download, edits, redactions, reactions, receipts, and an encrypted room round-trip. Everything else belongs in unit tests, which are two orders of magnitude faster.

## Before handing work over

```sh
npm run verify     # typecheck + lint + unit tests
```

Integration tests run before a release and whenever the session, timeline, or crypto layers change. See [../ops/synapse.md](../ops/synapse.md) for starting the server.
