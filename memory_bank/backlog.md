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

Everything still open, and what waits behind it. The version in the repository
is 0.2.0, but npm still serves 0.0.12 and there is no tag, so none of this has
reached a consumer yet. The version is below 1.0.0 because these items are
open; closing them is what 1.0.0 means here.

Nothing here is a defect any more. What remains is four toolchain versions
held back by third parties and two items waiting on React Native itself —
every one re-measured rather than assumed, with the measurement recorded
beside it.

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
| BL-15 | Consider `matrix-js-sdk` 42 | Done. 160 unit and 26 integration tests pass against 42.2.0, and `example/` bundles for both platforms. It needs `@babel/plugin-transform-export-namespace-from` in every consuming app; the peer floor is now `>=42.0.0` |
| BL-17 | Verify `matrix-js-sdk` 42 under Hermes | Done on an iOS 26 simulator: login, first sync, room list, timeline (day separator, `edited`, redaction tombstone, reply quote), and a send that appeared once and came back through sync — the list re-sorted and the unread count dropped, so the round-trip is the homeserver's, not local echo. Also run on a physical Realme RMX3363, Android 13, during the 0.2.0 pass |
| BL-22 | Jest 30 running a Jest 29 transformer | Closed with an `overrides` block pinning `babel-jest`, `jest-environment-node` and `@jest/create-cache-key-function` to 30.5.0. The React Native preset still asks for `^29.7.0`; the override is what removes the skew. 160 unit and 26 integration tests pass on the matched stack |
| BL-23 | `normalizeText` was dead | Removed from `utils/format.ts` |
| BL-25 | `ReadReceipt` was an orphan public type | Removed from `types/timeline.ts` before the first release of this API, so it never becomes a compatibility promise |
| BL-26 | `summarizeReactionEvents` was exported for no one | Now internal to `timeline/reactions.ts`|
| BL-24 | `buildReplyFallback` and `escapeHtml` were tested but never called | Both removed with their tests. Replies keep going out with `m.in_reply_to` and no plain-text fallback, which is now stated in [domain/timeline.md](domain/timeline.md#replies) rather than left implicit |
| BL-27 | `DaySeparator` promised "Today" / "Yesterday" and rendered a bare date | Wired up. The two relative words are new keys on the public `labels` object, so they translate with everything else; the absolute date stays with `Intl` and the locale. `isYesterday` is finally called by something. Six tests cover it, including the month boundary and the late-evening case the 0.0.x elapsed-hours bug got wrong |

## Closed by the 0.1.0 version work

| ID | Item | Outcome |
|-|-|-|
| BL-12 | The documentation described FT-001 as unfinished | [product/roadmap.md](product/roadmap.md) listed stages 6 to 11 as `planned` while all were built; they now read `done`, and stage 11 reads `in_progress` because only the npm release is left. `delivery_status: in_progress` on [feature.md](features/FT-001-typescript-rewrite/feature.md) and in [features/README.md](features/README.md) stays, and is no longer a contradiction: the 0.1.0 release is in the feature's scope and has not happened. Both now say so in one line, so it is not re-raised |

## Closed by 0.2.0

| ID | Item | Outcome |
|-|-|-|
| BL-1 | A missing `crypto.getRandomValues` failed illegibly | `start()` now checks host requirements before anything else and throws `HostRequirementError`, naming the global, why the library needs it, and the package that supplies it. `missingHostRequirement()` and `isHostSupported()` are exported for checking earlier |
| BL-5 | The example's stand-in picker returned a `data:` URI that Android's `fetch` cannot read | Fixed in the library rather than the example: `sendFile` decodes data URIs itself, so any adapter returning in-memory bytes works on both platforms. Base64 is decoded without `atob`, which Hermes lacks. The wrong comment on `sendFile` is gone. **Verified on the platform that was broken**: on a Realme RMX3363, Android 13, the `+` control uploaded `sample.png` — `m.image`, 86 bytes, PNG magic, downloaded back through the authenticated endpoint — with no `Network request failed` anywhere in logcat |
| BL-6 | The example's encryption toggle silently did nothing | The switch is disabled when the engine cannot run encryption and states the reason. Verified on an iPhone 16e simulator and on a physical Android 13 device: the control is greyed out and prints the WebAssembly reason. On Android the check is pixel-exact — zero pixels in the switch changed after a tap. `engineCryptoLimitation()` and `cryptoUnavailableReason()` were added so any host can do the same; the first needs no credentials, which is what a sign-in screen has |
| BL-7 | `timeline/roomSummary.ts` was at 0% while holding the audit's sort defect | 19 tests, including one that ten reversed entries can only pass with a signed comparator |
| BL-8 | The test environment was more capable than the device | Asserted, not described: `hostSupport.test.ts` removes `globalThis.crypto` — the global `jest.setup.ts` installs because Hermes has none — and proves the library detects it. The `URL` half closed with the 0.87 floor |
| BL-9 | Nothing stopped coverage falling | `coverageThreshold` in `jest.config.js`, set just under the measured value as a floor. Coverage rose from 55.0% to 59.7% statements, 160 tests to 225 |
| BL-14 | `peerDependencies` promised a range nothing tested | Raised to React `>=19.0.0` and React Native `>=0.81.0`. 0.81 is where Metro defaults package exports on, without which `matrix-js-sdk` cannot resolve its crypto backend; below that the library needed configuration it cannot verify |

## Closed after 0.2.0

| ID | Item | Outcome |
|-|-|-|
| BL-11 | Five hooks at 0% | All five are at 100% statements, branches, functions and lines: 54 tests across `useMatrix`, `useRooms`, `useRoom`, `useReceipts` and `useRoomEncryption`. The fake session grew what they needed — several rooms rather than one, `m.direct` account data, read receipts, room state, and a status object that is **replaced** rather than mutated, because `useSyncExternalStore` compares snapshots by identity and a fake that mutated in place would pass while the hook was broken. Unit tests went from 225 to 279 and coverage from 59.7% to 70.7% statements. Re-checking the coverage report afterwards turned up one gap this item never named — `components/TypingIndicator.tsx` at 0%, with the one/two/many branching and the display-name fallback untested, and its three `labels` functions uncovered with it. Covered too, at 100%, which took the suite to 287 tests and 71.9%; the floor in `jest.config.js` moved up with it |
| BL-28 | The composer could not be driven on the iOS simulator | Not an iOS input problem at all. The dev-build LogBox toast is a full-width overlay pinned to the bottom of the window, directly over the message field and the `+`, and it was eating the taps — so the homeserver saw nothing, which read as "injection does not reach the composer". Dismiss it and the whole flow drives: tap focuses the field, `text` types into it, `Send` posts. **Verified against the homeserver**, not against the screen: `$JADb5A039V…`, `@alice:localhost`, body `Ios composer bl28` — the leading capital is the iOS keyboard's autocapitalisation, which is itself evidence the text went through the real input path. The `+` control then uploaded `sample.png` as `m.image`, 86 bytes, `mxc://localhost/AMRIRYxDYog…`. iOS is now as machine-checkable as Android. The trap is recorded in [engineering/gotchas.md](engineering/gotchas.md#react-native) |
| BL-29 | Three Metro warnings on every `example/` bundle | `extraNodeModules` now maps `react-native-matrix` at the package root instead of `<root>/src`, so Metro resolves it through the package's own `exports` and the `react-native` condition sends both entry points back to source. Verified by bundling both platforms: the three `./src` warnings are gone, `lib/` does not exist, and the library's own strings are in the bundle — so it really did resolve to source. Confirmed at runtime too: the app signs in, syncs and sends on the new mapping. One warning remains and is not ours — React Native importing its own unlisted `./src/private/featureflags/ReactNativeFeatureFlags` |

## Closed after 0.2.0 — push

| ID | Item | Outcome |
|-|-|-|
| BL-31 | **Push notification helpers.** Built: `registerPusher` / `unregisterPusher` / `getPushers` on the session, a `pushToken` adapter with automatic re-registration on rotation, a `NotificationLevel` mapping over push rules with `getNotificationLevel` / `setNotificationLevel` and a `useRoomNotifications` hook, and `resolvePushEvent`, which turns the room and event IDs in an `event_id_only` payload into something displayable **without a running session** — the application may be woken into a background task with no sync loop. Delivery itself stays with the host: FCM, APNs and showing the banner are native work and this library ships no native code. Rules in [domain/push.md](domain/push.md) |
| BL-32 | **Five defects in BL-31, found by reviewing it rather than by writing it.** Recorded because each was a silent failure and four survived the first round of tests. (1) `append: false` does **not** remove a user's own previous pushkey — the specification deduplicates the same pushkey across *users* — so a rotated token left the old pusher registered and the homeserver pushing to a key nothing reads; caught by the live homeserver, not by reasoning. (2) `registerPusher` returned early when the adapter had no token yet and never subscribed to rotation, so the ordinary first launch — permission granted after the app is already running — registered nothing, ever. (3) `unregisterPusher` forgot the pusher before the removal was confirmed, so a failed sign-out left the device receiving pushes with no way to retry: the retry saw nothing to remove. (4) `unregisterPusher` could only remove what the *same session* had registered, which is not how sign-out happens — a pusher written on an earlier launch is unknown to a fresh session, so the documented "sign-out must call this" removed nothing after a restart. It now takes `{ appId, pushkey? }` and falls back to the adapter's token. (5) Registering with no `pushToken` adapter at all returned null instead of throwing, making a forgotten adapter indistinguishable from an ungranted permission and breaking the project's own rule that [a missing adapter is never a silent no-op](engineering/adapters.md#absence-behaviour). Each is covered by an integration test, and each test was checked by reintroducing the defect |

## Deferred to 0.3.0

| ID | Item |
|-|-|
| BL-30 | **Threads as a view, not just a relation.** Sending already works — `sendText` takes `threadRootId`, sets `rel_type: m.thread` with `is_falling_back`, and passes the thread ID to `client.sendMessage`. Reading is half-built: `buildTimelineItem` fills `TimelineItem.thread`, but with `replyCount: 0` hardcoded, so the field has always lied — the real number is `Thread.length`, which only exists once thread support is on. What is needed: `threadSupport: true` on `createClient`, a `ThreadTimeline` built on `thread.timelineSet` the way [RoomTimeline](../src/timeline/RoomTimeline.ts) is built on the live timeline, `useThreads` and `useThread`, a thread list and screen, and a reply-count affordance on `MessageRow`. **The flag is the hard part, not the UI**: with it on the SDK takes thread replies out of the main live timeline, `markRead` starts sending threaded receipts, and the room's unread count stops including threads — so `buildRoomSummary` has to add the per-thread counts back or it will quietly under-report. Three behaviour changes a consumer can see, which is why this is its own release and why each needs an integration test against Synapse rather than a unit test against a fake |

## Toolchain holds

Each is the newest release the rest of the toolchain accepts, not an oversight.
Re-check when the named blocker clears.

Re-measured on 2026-08-29: nothing has moved. `@typescript-eslint` 8.68.0 still
declares `typescript: >=4.8.4 <6.1.0`; `@babel/eslint-parser` 8.0.1 still
requires `@babel/core@^8`; `@babel/plugin-syntax-dynamic-import` still has no
release past 7.8.3. The three rows below stand exactly as written.

| ID | Item | Blocker |
|-|-|-|
| BL-18 | TypeScript stays on 6.0.3; 7.0.2 is out | Only the linter blocks it. Measured on 7.0.2: `tsc --noEmit` passes and the full CJS/ESM/types build emits every entry point, with **no source changes at all** — so this is a one-line version bump the day the linter catches up. `@typescript-eslint` refuses to load against TS 7 (`typescript-eslint does not support TS 7.0`, peer `<6.1.0`); tracked upstream as typescript-eslint#10940 for TS 7.1. Scoping a nested TS 6 to it through `overrides` does not work — `typescript` is its peer, so npm dedupes to the root copy. The gain is real but small in absolute terms: typecheck 0.34s vs 1.45s, full build 0.88s vs 3.47s. The React Native 0.87 template also pins `typescript: ^6.0.3` |
| BL-19 | Babel stays on 7; 8.0.1 is out | Installing `@babel/core@8` does not move the toolchain: every consumer of Babel here — the React Native preset, the jest preset, Metro, `babel-jest` — depends on `@babel/core@^7`, so npm nests a 7 under each and the 8 at the top is loaded by nothing. Measured: 20 copies of `@babel/core` in the tree with 8 declared, 1 with 7. Forcing it with `overrides` is not an option either: `@react-native/babel-preset` depends on `@babel/plugin-syntax-dynamic-import`, which **has no 8.x release** — Babel 8 dropped it because the syntax is standard now. This moves when React Native's preset moves |
| BL-20 | `example/` stays on ESLint 9; 10.9.1 is out | Blocked behind BL-19, not behind the eslintrc format — `FlatCompat` handles that. Measured on ESLint 10: `TypeError: scopeManager.addGlobals is not a function`, because `@babel/eslint-parser` 7 (pulled in by `@react-native/eslint-config`) returns a scope manager from `eslint-scope` 5, which ESLint 10 no longer accepts. `@babel/eslint-parser` 8 supports ESLint 10, but requires `@babel/core@^8`. The library itself is on ESLint 10 |
| BL-21 | `@types/node` tracks 22, not 26 | Not a hold but a decision, kept here so it is not re-raised: `engines.node` is `>=22.13.0`, and types newer than the supported floor would typecheck against APIs absent on it. This moves only if `engines` moves |

## After 0.2.0

| ID | Item |
|-|-|
| BL-13 | Verify SC-9 on a device once any React Native engine ships WebAssembly. React Native `latest` is still 0.87.1 as of 2026-08-29, so there is still nothing to test against. Encryption is proved only against Node today. The claim that React Native 0.84+ would bring it through Hermes v1 was wrong and has been corrected in [ADR-003](adr/ADR-003-optional-e2ee-backend.md) and [domain/encryption.md](domain/encryption.md) |
| BL-16 | Drop `SafeAreaView` from the example's own screens if React Native removes it. It is deprecated in 0.87 and stopped applying the top inset, which put the header under the status bar; the example now uses `react-native-safe-area-context`, as the React Native template does. Still only deprecated as of 2026-08-29 — `react-native/index.js` exports it with a runtime warning — so there is nothing to drop yet |


The capability work that follows — threads and push helpers — stays in
[product/roadmap.md](product/roadmap.md). Sync-token persistence shipped in
0.2.0; spaces are a non-goal, recorded in [product/context.md](product/context.md).
