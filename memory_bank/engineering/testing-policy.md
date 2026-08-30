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

`jest.config.js` sets a `coverageThreshold` anyway. It is a floor, not a goal: it exists because the percentage fell twice while modules were added faster than tests, and nothing objected. Keep it just under the measured value, and raise it when a run clears the next step.

It may also move **down**, but only with the reason written next to it. The push work lowered the global figure from 71.9% to 70.2% while adding tests, because most of what it added is `MatrixSession` and the fetching half of `resolvePushEvent` — both covered by `integration/`, neither countable here. A floor that forbade this would push work into unit tests against a fake of the SDK, which is the thing this policy exists to prevent. What the floor catches is an *unexplained* fall.

## What is deliberately not unit tested

Left uncovered on purpose, so it is not repeatedly re-raised:

| Module | Covered by | Why not a unit test |
|-|-|-|
| `core/MatrixSession.ts` | `integration/` | It is the SDK boundary. A unit test would assert against a fake of `matrix-js-sdk`, which proves the fake behaves, not the session. The local-echo re-keying defect is exactly this: the unit fake modelled the two event IDs as equal, the suite passed, and every sent message rendered twice against a real homeserver |
| `components/ChatScreen.tsx`, `components/RoomList.tsx` | Manual, in `example/` | Compositions of tested parts whose remaining behaviour is keyboard and scroll handling. SC-12 is manual for the same reason: it depends on device, OS version, and window softInput mode |


Anything else at zero coverage is a gap, not a policy. The hooks used to sit
in this table with the note that they were a gap rather than a decision; they
are covered now, at 100%, and the row is gone rather than reworded.

## What integration tests own

Behaviour that only a real homeserver can prove: login and sync, send and receive across two users, media upload and authenticated download, edits, redactions, reactions, receipts, an encrypted room round-trip, and resuming a session from a persisted sync token — the unit suite can prove the store writes a token, only a homeserver can prove the token is accepted. Everything else belongs in unit tests, which are two orders of magnitude faster.

## Before handing work over

```sh
npm run verify     # typecheck + lint + unit tests
```

Integration tests run before a release and whenever the session, timeline, or crypto layers change. See [../ops/synapse.md](../ops/synapse.md) for starting the server.
