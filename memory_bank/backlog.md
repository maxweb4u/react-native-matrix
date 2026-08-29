---
doc_kind: project
doc_function: canonical
purpose: Open work items found once FT-001 was exercised on real targets — release blockers, test gaps, and follow-ups.
derived_from:
  - features/FT-001-typescript-rewrite/feature.md
  - engineering/testing-policy.md
status: active
audience: humans_and_agents
canonical_for:
  - open_work_items
---

# Backlog

Everything still open after 0.1.0, and what waits behind it. The version is
below 1.0.0 because these items are open; closing them is what 1.0.0 means
here.

Two device passes produced most of this: the first on React Native 0.76 with a
physical Android device, the second after the upgrade to React Native 0.87 with
React 19, on that device and on an iOS 26 simulator.

The traps themselves belong to
[engineering/gotchas.md](engineering/gotchas.md); this file owns the work, not
the explanation.

## Closed by the React 19 / React Native 0.87 upgrade

Kept here because each was a blocker, and because the reason it closed is worth
knowing before someone re-adds it.

| ID | Item | Outcome |
|-|-|-|
| BL-2 | Spec-compliant `URL` required | React Native 0.87 stopped appending a trailing slash to the absolute URLs the SDK builds. Verified on device with no URL polyfill installed. Applications below 0.87 still need one |
| BL-3 | Host requirements missing from the docs | `README.md` now states the `crypto.getRandomValues` polyfill, and scopes the Metro setting and the `URL` polyfill to the versions that need them |
| BL-4 | SC-12 unverified on iOS | Verified on an iOS 26 simulator: the list resizes, the composer sits above the keyboard, the newest message stays visible. SC-12 now holds on both platforms |

## Closed by the dependency sweep

A pass over every dependency in both packages, after the React 19 / React
Native 0.87 upgrade.

| ID | Item | Outcome |
|-|-|-|
| BL-10 | Lint `example/` | The app now has its own flat `eslint.config.js` on ESLint 9 and lints clean. Without one ESLint climbed to the root config and reported every file as ignored — see [engineering/gotchas.md](engineering/gotchas.md#packaging) |
| BL-15 | Consider `matrix-js-sdk` 42 | Done. 157 unit and 26 integration tests pass against 42.2.0, and `example/` bundles for both platforms. It needs `@babel/plugin-transform-export-namespace-from` in every consuming app; the peer floor is now `>=42.0.0` |
| BL-17 | Verify `matrix-js-sdk` 42 under Hermes | Done on an iOS 26 simulator: login, first sync, room list, timeline (day separator, `edited`, redaction tombstone, reply quote), and a send that appeared once and came back through sync — the list re-sorted and the unread count dropped, so the round-trip is the homeserver's, not local echo. Not yet run on a physical device |
| BL-22 | Jest 30 running a Jest 29 transformer | Closed with an `overrides` block pinning `babel-jest`, `jest-environment-node` and `@jest/create-cache-key-function` to 30.5.0. The React Native preset still asks for `^29.7.0`; the override is what removes the skew. 157 unit and 26 integration tests pass on the matched stack |
| BL-23 | `normalizeText` was dead | Removed from `utils/format.ts` |
| BL-25 | `ReadReceipt` was an orphan public type | Removed from `types/timeline.ts` before the first release of this API, so it never becomes a compatibility promise |
| BL-26 | `summarizeReactionEvents` was exported for no one | Now internal to `timeline/reactions.ts`|
| BL-24 | `buildReplyFallback` and `escapeHtml` were tested but never called | Both removed with their tests. Replies keep going out with `m.in_reply_to` and no plain-text fallback, which is now stated in [domain/timeline.md](domain/timeline.md#replies) rather than left implicit |
| BL-27 | `DaySeparator` promised "Today" / "Yesterday" and rendered a bare date | Wired up. The two relative words are new keys on the public `labels` object, so they translate with everything else; the absolute date stays with `Intl` and the locale. `isYesterday` is finally called by something. Six tests cover it, including the month boundary and the late-evening case the 0.0.x elapsed-hours bug got wrong |

## Release blockers

| ID | Item | Evidence |
|-|-|-|
| BL-1 | `crypto.getRandomValues` is a hard host requirement and stays one. Hermes exposes no Web Crypto, and `matrix-js-sdk` calls it for every transaction ID, so the session throws before the first sync. Now documented; what is still missing is a legible failure — the host currently gets a raw `TypeError` from inside the SDK rather than a named error the way `CryptoUnavailableError` names a missing crypto backend | Measured `undefined` on both 0.76 and 0.87 |
| BL-5 | Fix the stand-in image picker in `example/src/adapters.ts`. It returns a `data:` URI, which React Native's `fetch` cannot read on Android — the attachment fails with "Network request failed" before any request leaves the device. The comment on `MatrixSession.sendFile` claiming `fetch` handles data URIs is wrong on Android. The upload path itself is fine: proved by substituting a real `file://` URI, which uploaded and rendered through the authenticated media endpoint | — |
| BL-6 | Make the example's encryption toggle say when it does nothing. With no WebAssembly, `isCryptoSupported` returns false and the session silently starts unencrypted. That is the silent no-op [FM-1](features/FT-001-typescript-rewrite/feature.md) exists to forbid and the adapter contract refuses everywhere else. This now matters more, not less: no stock React Native has WebAssembly, so the toggle is inert for every user | Measured: `WebAssembly` and `indexedDB` both `undefined` on 0.87.1 with `hermesEnabled=true` |

## Test gaps

| ID | Item | Evidence |
|-|-|-|
| BL-7 | Add `src/timeline/__tests__/roomSummary.test.ts`. The file is at **0%** unit coverage, and it holds `sortRoomSummaries` — the boolean-comparator defect from the audit. [The implementation plan](features/FT-001-typescript-rewrite/implementation-plan.md) claims step 7 is verified by unit tests and [feature.md](features/FT-001-typescript-rewrite/feature.md) promises a regression test per audit defect; for this one neither exists, in unit or integration | Coverage report; no such test file |
| BL-8 | Close the environment-parity hole. `jest.setup.ts` installs a `crypto` global Hermes lacks, and Node's `URL` is spec-compliant where React Native's was not. Both release blockers of the first device pass lived in that gap. Either assert the host contract in a test or make a device smoke run part of [the release checklist](ops/release.md) | `jest.setup.ts` |
| BL-9 | Set `coverageThreshold` in `jest.config.js`. Unit coverage is 54.4% statements / 50.1% branches / 48.4% functions with nothing to stop it falling further | — |
| BL-11 | Decide what else deserves unit tests. Zero-coverage modules beyond BL-7: `react/useRooms.ts`, `react/useRoom.ts`, `react/useReceipts.ts`, `react/useMatrix.ts`, `crypto/useRoomEncryption.ts`, `components/RoomList.tsx`, `components/ChatScreen.tsx`, `components/TypingIndicator.tsx`. Thin: `core/errors.ts` at 29%, `utils/format.ts` at 48%. `core/MatrixSession.ts` sits at 0.86% and is covered by the integration suite instead, which is a deliberate split worth stating in [the testing policy](engineering/testing-policy.md) rather than leaving to be rediscovered | Coverage report |
| BL-14 | Test against the declared floor, or raise it. `peerDependencies` still promises React 18.2+ and React Native 0.74+, but everything is built and tested against React 19.2 and 0.87 only, and the components are typed against `@types/react` 19. The `matrix-js-sdk` half of this is closed — its floor was raised to the tested 42 — but React and React Native need either a floor job or a narrower range | `package.json` |

## Toolchain holds

Each is the newest release the rest of the toolchain accepts, not an oversight.
Re-check when the named blocker clears.

| ID | Item | Blocker |
|-|-|-|
| BL-18 | TypeScript stays on 6.0.3; 7.0.2 is out | Only the linter blocks it. Measured on 7.0.2: `tsc --noEmit` passes and the full CJS/ESM/types build emits every entry point, with **no source changes at all** — so this is a one-line version bump the day the linter catches up. `@typescript-eslint` refuses to load against TS 7 (`typescript-eslint does not support TS 7.0`, peer `<6.1.0`); tracked upstream as typescript-eslint#10940 for TS 7.1. Scoping a nested TS 6 to it through `overrides` does not work — `typescript` is its peer, so npm dedupes to the root copy. The gain is real but small in absolute terms: typecheck 0.34s vs 1.45s, full build 0.88s vs 3.47s. The React Native 0.87 template also pins `typescript: ^6.0.3` |
| BL-19 | Babel stays on 7; 8.0.1 is out | Installing `@babel/core@8` does not move the toolchain: every consumer of Babel here — the React Native preset, the jest preset, Metro, `babel-jest` — depends on `@babel/core@^7`, so npm nests a 7 under each and the 8 at the top is loaded by nothing. Measured: 20 copies of `@babel/core` in the tree with 8 declared, 1 with 7. Forcing it with `overrides` is not an option either: `@react-native/babel-preset` depends on `@babel/plugin-syntax-dynamic-import`, which **has no 8.x release** — Babel 8 dropped it because the syntax is standard now. This moves when React Native's preset moves |
| BL-20 | `example/` stays on ESLint 9; 10.9.1 is out | Blocked behind BL-19, not behind the eslintrc format — `FlatCompat` handles that. Measured on ESLint 10: `TypeError: scopeManager.addGlobals is not a function`, because `@babel/eslint-parser` 7 (pulled in by `@react-native/eslint-config`) returns a scope manager from `eslint-scope` 5, which ESLint 10 no longer accepts. `@babel/eslint-parser` 8 supports ESLint 10, but requires `@babel/core@^8`. The library itself is on ESLint 10 |
| BL-21 | `@types/node` tracks 22, not 26 | Not a hold but a decision, kept here so it is not re-raised: `engines.node` is `>=22.13.0`, and types newer than the supported floor would typecheck against APIs absent on it. This moves only if `engines` moves |

## Documentation consistency

| ID | Item |
|-|-|
| BL-12 | [product/roadmap.md](product/roadmap.md) still lists stages 6 to 11 as `planned`. All are built, and the roadmap is `canonical_for: delivery_order`, so it currently contradicts the implementation plan |

## After 0.1.0

| ID | Item |
|-|-|
| BL-13 | Verify SC-9 on a device once any React Native engine ships WebAssembly. Encryption is proved only against Node today. The claim that React Native 0.84+ would bring it through Hermes v1 was wrong and has been corrected in [ADR-003](adr/ADR-003-optional-e2ee-backend.md) and [domain/encryption.md](domain/encryption.md) |
| BL-16 | Drop `SafeAreaView` from the example's own screens if React Native removes it. It is deprecated in 0.87 and stopped applying the top inset, which put the header under the status bar; the example now uses `react-native-safe-area-context`, as the React Native template does |


The capability work that follows 0.1.0 — threads, sync-token persistence, push
helpers, spaces — stays in [product/roadmap.md](product/roadmap.md).
