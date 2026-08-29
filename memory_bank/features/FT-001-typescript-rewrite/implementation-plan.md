---
doc_kind: feature
doc_function: canonical
purpose: Ordered implementation steps for the 0.1.0 rewrite and how each is verified.
derived_from:
  - feature.md
status: active
---

# FT-001 — Implementation Plan

## Order

| # | Step | Touches | Verification | State |
|-|-|-|-|-|
| 1 | Package scaffold: TypeScript, ESLint, Jest projects, build pipeline, remove `postinstall` | `package.json`, `tsconfig*`, `jest.config.js`, `eslint.config.mjs` | `npm run verify` | done |
| 2 | Memory bank | `memory_bank/` | Index reachability; every document has frontmatter | done |
| 3 | Public types | `src/types/` | `npm run typecheck` | done |
| 4 | Core: errors, emitter, mxc, utils | `src/core/`, `src/utils/` | Unit tests (SC-3, SC-5, SC-6) | done |
| 5 | `MatrixSession` | `src/core/MatrixSession.ts` | Typecheck; integration in step 10 | done |
| 6 | Timeline: parsing, store, reactions, item builder | `src/timeline/` | Unit tests (SC-2, SC-7) | done |
| 7 | Room summaries and direct-room detection | `src/timeline/roomSummary.ts` | Unit tests | done |
| 8 | React layer: provider and hooks | `src/react/` | Unit tests (SC-4) | done |
| 9 | Adapter contracts and access | `src/types/adapters.ts`, `src/react/useAdapters.ts` | Unit tests (SC-11) | done |
| 10 | Synapse in Docker and integration suite | `docker/`, `scripts/`, `integration/` | `npm run test:integration` (SC-8) | done |
| 11 | Components on React Native primitives | `src/components/` | Component tests; manual in `example/` | done |
| 12 | Optional E2EE module | `src/crypto/` | Unit (SC-10) and integration (SC-9) | done |
| 13 | `example/` application | `example/` | Manual on both platforms (SC-1, SC-12) | done — Android device and iOS simulator, on React Native 0.87 |
| 14 | README, migration guide, CHANGELOG, release | root docs, `package.json` | `npm pack --dry-run`; release checklist | docs done; publish blocked on [the backlog](../../backlog.md) |

No-op default adapters were dropped from the plan: a no-op is precisely the silent failure the policy forbids. `useAdapters().has` gates the UI and `.require` throws, which covers both cases without a fake implementation.

Upgrading to React 19 and React Native 0.87 closed two of the blockers below and opened one of its own. React Native's `URL` stopped mangling the SDK's requests and Metro turned package exports on by default, so two documented host requirements fell away; but 0.87 turns edge-to-edge on, an edge-to-edge window is not resized for the keyboard, and SC-12 broke — the composer went back under the keyboard on Android, which is the original 0.0.x defect arriving by a new route. `ChatScreen` now applies `KeyboardAvoidingView` padding on both platforms. SC-12 is verified on an Android device and an iOS simulator, so the criterion holds on both platforms for the first time. The upgrade also disproved the WebAssembly claim this project had been repeating: `globalThis.WebAssembly` is `undefined` on 0.87.1 with Hermes enabled, so encryption cannot start on any stock React Native, and [ADR-003](../../adr/ADR-003-optional-e2ee-backend.md) has been corrected.

Running step 13 on a physical Android device continued the pattern and produced two release blockers, both recorded in [the backlog](../../backlog.md) and [../../engineering/gotchas.md](../../engineering/gotchas.md). The library did not start at all: Hermes has no `globalThis.crypto`, and React Native's own `URL` appends a trailing slash to every request the SDK builds, so the homeserver answered 405. Neither is visible to any check in this repository, because `jest.setup.ts` supplies the missing crypto global and Node's `URL` is spec-compliant — the test environment is more capable than the target, which is the same failure mode as the unit fakes in step 10, one layer down. Past those two, the device confirmed SC-1, SC-3, SC-5, SC-6, SC-7, SC-11 and SC-12 along with edits, redactions, reactions, typing and read receipts; SC-9 could not be exercised at all, because the engine that ships with React Native 0.76 has no WebAssembly.

Step 13 found the worst of them, and found it the only way it could be found — by bundling. React Native 0.76 ships Metro with package exports disabled, `@matrix-org/matrix-sdk-crypto-wasm` declares no `main`, and `matrix-js-sdk` imports it unconditionally, so **every** consuming application fails to bundle until it sets `resolver.unstable_enablePackageExports`. Typecheck, lint, unit tests, and the integration suite all pass without it. The same step also caught three library defects that only a consumer's compiler sees: `MatrixProvider` declared `ReactNode` as its return type, which React 18's JSX types reject; `Emitter.on` relied on narrowing that older TypeScript drops inside a closure; and two globals were read in a way that requires the consumer's `tsconfig` to include a particular `lib`.

Step 12 found two more, both of which would have shipped: the SDK's Rust crypto store defaults to IndexedDB, which React Native does not have, so encryption aborted inside WebAssembly on every target device; and the optional peer dependency this project declared for `@matrix-org/matrix-sdk-crypto-wasm` contradicted `matrix-js-sdk` 37, which depends on it directly and on a different major. Both are recorded in [ADR-003](../../adr/ADR-003-optional-e2ee-backend.md) and [../../domain/encryption.md](../../domain/encryption.md).

Step 10 paid for itself immediately. Five defects in the rewrite survived a green unit suite and failed on first contact with a homeserver: local echo re-keyed by transaction ID rather than by the SDK's provisional event ID, every media URL resolving to a cropped thumbnail, edits never becoming visible, an outgoing reaction keeping its provisional ID so it could not be removed, and `m.direct` never being written so no room was ever direct. Each is now a unit regression as well as an integration test, and each is recorded in [../../engineering/gotchas.md](../../engineering/gotchas.md). The common thread is that the unit fakes encoded the same misunderstanding of the SDK as the code they were testing, which is the failure mode integration tests exist to catch.

## Dependencies

Steps 3 to 6 are prerequisites for everything above them. Step 10 can proceed in parallel with 7 to 9 because the harness only needs `MatrixSession`. Step 12 depends on 10, since the encrypted round-trip is only provable against a real homeserver.

## Rollback

The 0.0.x line stays published on npm under its existing version, so consumers are unaffected until they opt in. If 0.1.0 proves wrong in shape, the recovery is a 0.2.0 with a corrected API rather than a revert: the defects in 0.0.x make restoring it unacceptable.
