---
doc_kind: feature
doc_function: canonical
purpose: Rebuild the library in TypeScript with no runtime dependencies, fixing the defects and gaps that made 0.0.x unusable.
derived_from:
  - ../../product/context.md
  - ../../product/roadmap.md
status: active
delivery_status: in_progress
---

# FT-001 — TypeScript rewrite

Delivery steps and their verification: [implementation-plan.md](implementation-plan.md).

## Delivery

All eleven stages of [the roadmap](../../product/roadmap.md) are built, verified, and merged to `master`. `delivery_status` stays `in_progress` for one reason: the release is in scope above, and it has not happened. The version in the repository is `0.2.0`, but there is no tag and npm still serves `0.0.12`. This moves to `done` when [../../ops/release.md](../../ops/release.md) has been worked through, not before.

Every acceptance criterion is met except SC-9, which cannot be exercised on a device: no React Native engine available today has WebAssembly. It is verified against Node only, and tracked as BL-13 in [../../backlog.md](../../backlog.md).

## Problem

Version 0.0.12, published in 2022, cannot be installed into a current React Native project and cannot serve a modern Matrix homeserver.

Installation fails outright: a `postinstall` script rewrites files inside `react-native` and `matrix-js-sdk` using a hard-coded relative path and no error handling, and those files no longer exist. Even past that, `matrix-js-sdk ^7` is five majors behind and the imported constants were renamed, `react-native-image-picker ^1` removed the API in use, and `rn-fetch-blob` is archived.

Beyond packaging, three classes of defect matter:

1. **Correctness.** A duplicated `messageSent` definition silently disabled read markers for sent messages; a boolean sort comparator randomised the chat list; a wrong-arity call left accepted invites invisible; a missing translation key rendered `[object Object]` in the Android action sheet.
2. **Security.** Access tokens travelled in query strings. Media authentication used a header homeservers ignore. Event content was copied key-by-key onto model instances whose prototypes had getter-only accessors, so any room member could crash every other client by sending a message containing a key named `message` or `type`.
3. **Capability.** No encryption, no message editing or deletion, no real reactions, no typing indicators, no read receipts, and a full room-model rebuild on every incoming event.

The full audit is recorded in the pull request for this package.

## Scope

In scope:
- TypeScript rewrite of every module, hooks-first, with `MatrixSession` replacing the singleton.
- Zero runtime dependencies; native capability moved to adapters ([ADR-001](../../adr/ADR-001-zero-runtime-dependencies.md)).
- Fixes for every defect found in the audit, each with a regression test.
- New capability: E2EE, edits, redactions, full reactions, typing, read receipts, video, location, thread relations.
- Unit suite plus an integration suite against a local Synapse.
- `example/` application.
- Documentation, migration guide, and the first npm release of the new API.

Out of scope:
- Backwards compatibility with the 0.0.x API. The rewrite is a deliberate break; a compatibility shim would preserve the architecture that caused the defects.
- Login, registration, and SSO UI, which stay with the host application.
- Thread and space UI, key backup UI, VoIP. See [../../product/roadmap.md](../../product/roadmap.md).

## Acceptance criteria

| ID | Criterion | Verified by |
|-|-|-|
| SC-1 | The package installs into a current React Native project with no postinstall step and no runtime dependencies | `npm pack --dry-run`; `example/` install |
| SC-2 | Hostile event content cannot crash rendering | `src/timeline/__tests__/parseContent.test.ts` |
| SC-3 | Access tokens never appear in a URL; media resolves through the authenticated endpoint | `src/core/__tests__/mxc.test.ts`; `integration/media.test.ts` |
| SC-4 | Several chat screens observe one session concurrently without losing updates | `src/react/__tests__/useTimeline.test.tsx` |
| SC-5 | A day separator appears whenever two messages fall on different calendar days | `src/utils/__tests__/datetime.test.ts` |
| SC-6 | A reply fallback is stripped without mangling messages containing `>` | `src/utils/__tests__/quote.test.ts` |
| SC-7 | Local echo is re-keyed on confirmation and never renders twice | `src/timeline/__tests__/TimelineStore.test.ts` |
| SC-8 | Edits, redactions, and reactions round-trip against a real homeserver | `integration/messaging.test.ts` |
| SC-9 | An encrypted room round-trips between two devices | `integration/encryption.test.ts` |
| SC-10 | Requesting encryption without the backend throws a named, actionable error | `src/crypto/__tests__/cryptoSupport.test.ts` |
| SC-11 | A missing adapter hides its control and throws when invoked directly | `src/components/__tests__/Composer.test.tsx` |
| SC-12 | The composer resizes with the keyboard on Android as well as iOS | Manual in `example/`; recorded as an exception below |

## Failure modes

| ID | Mode | Handling |
|-|-|-|
| FM-1 | Crypto backend absent or engine lacks WebAssembly | `CryptoUnavailableError` naming the missing piece; the session does not start unencrypted |
| FM-2 | Room requested before it is synced | `RoomNotFoundError` with the room ID |
| FM-3 | Adapter missing for an invoked feature | `AdapterMissingError` naming the adapter and the wiring call |
| FM-4 | Sync connection lost | Status moves to `reconnecting`; the SDK retries; no data is dropped |
| FM-5 | Attachment upload fails after the local echo appears | Row moves to `failed` with a retry path; the echo is not silently removed |

## Manual-only verification

SC-12 is manual. Keyboard behaviour depends on device, OS version, and window softInput mode, and no deterministic automated check reproduces it in CI. Procedure: in `example/`, open a chat on an Android device and on an iOS device, focus the composer, and confirm the message list resizes and stays scrolled to the newest message. Evidence is recorded in the release checklist.

## Public API impact

Total replacement. Every 0.0.x export is removed; the new surface is `MatrixProvider`, the hooks, the default components, `MatrixSession`, the types, and the `react-native-matrix/crypto` entry point. The migration guide in `README.md` maps old to new.
