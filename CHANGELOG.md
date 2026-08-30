# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org) against the public API defined in
`memory_bank/engineering/architecture.md`.

## [0.2.0] — 2026-08-29

The first release of this API to reach npm. 0.1.0 below was only ever a
version number in the repository — never tagged, never published — so its
entry is the changelog of the rewrite and this one is the changelog of what
came after it. Installing 0.2.0 gets both.

Nothing here changes what the library renders. It closes the gaps that made
0.1.0 hard to trust: a failure that could not be read, a promise that was never
tested, an example that broke its own rule, and the slowest thing a user waits
for.

Breaking, and cheap to absorb while the package is below 1.0.0: the React and
React Native peer floors rise. See **Changed**.

### Added

- **Push notification helpers.** `registerPusher`, `unregisterPusher` and
  `getPushers` on the session; a `pushToken` adapter that supplies the device
  token and, if it reports rotation, triggers re-registration; per-room
  notification settings as a `NotificationLevel` of `all`, `mentions` or
  `mute`, through `getNotificationLevel` / `setNotificationLevel` and the
  `useRoomNotifications` hook; and `resolvePushEvent`, which turns the two
  identifiers in an `event_id_only` payload into a renderable notification
  **without a running session** — an application woken into a background task
  has no sync loop, and starting one there is the last thing it should do.
  Delivery stays with the host: FCM, APNs and showing the banner are native
  work and this library ships no native code. An encrypted push comes back as
  `PushEventKind.Encrypted` with a null body rather than as an empty message,
  because no stock React Native engine can decrypt one. Rules in
  `memory_bank/domain/push.md`.
- **Persistent sync.** `syncStorage` on the session (and on `MatrixProvider`)
  makes a relaunch resume from the saved `next_batch` token instead of running
  a full initial sync. It is three methods — `getItem`, `setItem`,
  `removeItem` — so `@react-native-async-storage/async-storage` fits unchanged
  and MMKV or `expo-secure-store` need a three-line wrapper; the library
  depends on none of them. `session.flush()` forces a write before
  backgrounding and `session.clearPersistedSync()` discards the snapshot,
  which sign-out must call because the stored copy holds one account's rooms
  and message bodies. Tuning through `syncPersistence`. The rules are in
  `memory_bank/domain/sync.md`.
- **`HostRequirementError`**, thrown by `start()` before anything else when the
  engine is missing a global the library needs. Without
  `crypto.getRandomValues` the host used to get a bare `TypeError` from inside
  `matrix-js-sdk`, on the first request rather than at startup, naming neither
  the missing global nor the package that supplies it. `missingHostRequirement()`
  and `isHostSupported()` are exported for checking before a session is built.
- **`cryptoUnavailableReason()` and `engineCryptoLimitation()`** on
  `react-native-matrix/crypto`. `isCryptoSupported` answers whether;
  these answer why, so an application can put the reason on screen. The second
  needs no credentials, which is what a sign-in screen has before login.

### Changed

- **The React and React Native peer floors rise to 19.0 and 0.81**, from 18.2
  and 0.74. The old range was a promise nothing tested: the components are
  typed against `@types/react` 19, and `MatrixProvider` already could not be
  used under React 18's JSX types. 0.81 is where Metro enables package exports
  by default, which `matrix-js-sdk` needs to resolve its crypto backend at all,
  so below it the library did not work without configuration it cannot verify.
- **`sendFile` decodes `data:` URIs itself** rather than passing them to
  `fetch`. React Native's `fetch` reads them on iOS and rejects them on Android
  with "Network request failed" before any request leaves the device, so an
  adapter returning in-memory bytes uploaded on one platform only. Base64 is
  decoded without `atob`, which Hermes does not have.
- **The example's encryption toggle is disabled when the engine cannot run
  encryption**, and says why. It previously accepted the switch and started the
  session unencrypted — the silent no-op FM-1 exists to forbid, in the
  application meant to show the rule.

### Fixed

- The comment on `MatrixSession.sendFile` claimed `fetch` handles data URIs.
  It does not, on Android.
- Five defects in the push code, found by reviewing it after it was written
  and passing its first tests. All five were silent: none produced an error
  anywhere. `append: false` does **not** remove a user's own previous pushkey —
  the specification deduplicates the same pushkey across *users* — so a rotated
  token left the old pusher registered and the homeserver pushing to a key
  nothing reads. `registerPusher` returned early when the adapter had no token
  yet without subscribing to rotation, so the ordinary first launch, where
  permission is granted while the app is running, registered nothing ever.
  `unregisterPusher` forgot the pusher before the removal was confirmed, so a
  failed sign-out could not be retried. It also could only remove what the same
  session had registered, which is not how sign-out happens — it takes
  `{ appId, pushkey? }` now, because a pusher written on an earlier launch is
  unknown to a fresh session. And registering with no `pushToken` adapter at
  all returned null instead of throwing `AdapterMissingError`, which made a
  forgotten adapter look exactly like an ungranted permission.
- Mute is stored as an `override` rule, not the `room`-kind rule
  `MatrixClient.setRoomMutePushRule` writes: `room` is evaluated below the
  mention rules, so that spelling leaves a "muted" room buzzing on every
  mention. Verified by outcome rather than by shape — the integration suite
  sends a real mention and asserts the highlight count.
- `example/metro.config.js` mapped the library at `<root>/src`, a subpath the
  package's `exports` does not publish, so every bundle printed three "not
  listed in the exports" warnings and fell back to file-based resolution. It
  maps the package root now, which resolves through `exports` and the
  `react-native` condition — still from source, and silently. Nothing in the
  published package changes; a consumer never saw these.

### Testing

- `src/timeline/__tests__/roomSummary.test.ts`, previously at 0% coverage while
  holding `sortRoomSummaries` — the boolean-comparator defect from the audit.
  `feature.md` promised a regression test per audit defect and this one had
  none.
- The environment-parity hole is asserted rather than described:
  `hostSupport.test.ts` removes `globalThis.crypto`, which `jest.setup.ts`
  installs precisely because Hermes has none. Until now no unit test in the
  repository could fail the way a device does.
- **The React hooks are covered.** `useMatrix`, `useRooms`, `useRoom`,
  `useReceipts` and `useRoomEncryption` were at 0% and are at 100% on every
  measure, across 54 tests. `components/TypingIndicator.tsx` was at 0% too and
  is at 100% now — its one/two/many branching, the display-name fallback for a
  member who has not synced, and the three `labels` functions that go with
  them. The fake session grew what they needed: several
  rooms rather than one, `m.direct` account data, read receipts, room state,
  and a status object that is replaced rather than mutated — `useSyncExternalStore`
  compares snapshots by identity, so a fake that mutated in place would have
  passed while the hook was broken.
- `coverageThreshold` in `jest.config.js`, a floor rather than a target. Unit
  coverage is 70.2% statements across 332 tests, up from 55.0% and 160. It
  peaked at 71.9% before the push work, which added more integration-covered
  code than unit-covered code; the floor moved with it and the reason is
  recorded in the testing policy, because what a floor should catch is an
  unexplained fall.
  The hook and indicator tests were checked by mutation rather than by
  percentage: nineteen deliberate defects introduced into the modules they
  cover, eighteen caught. The one that survived — widening `useMatrix`'s
  subscription to room traffic — changes no observable behaviour, because
  `useSyncExternalStore` compares the snapshot with `Object.is` and the status
  object is identical between changes. Finding that is what replaced a test
  that had been asserting the fake rather than the hook.
- The testing policy now records which modules are deliberately not unit
  tested and why, so it stops being rediscovered.
- `integration/push.test.ts` proves against a real homeserver what only one
  can: that a registered pusher comes back from `GET /pushers`, that removal
  works, that a rotated token leaves exactly one pusher behind, that each
  notification level round-trips, that a mention is audible at `mentions` and
  silent at `mute` — asserted through the highlight count, so it tests what a
  level does rather than how it is spelled — and that sign-out can remove a
  pusher a previous launch registered. The integration suite is 47 tests, up
  from 30.
- `integration/syncPersistence.test.ts` proves the resume path against a real
  Synapse: the saved token is one the homeserver accepts, a second session sees
  the same rooms without a fresh initial sync, and `clearPersistedSync()`
  leaves nothing behind. The integration suite is 30 tests, up from 26.

### Verified on device

Both platforms against a local Synapse: an iPhone 16e simulator on iOS 26, and
a physical Realme RMX3363 on Android 13.

The `data:` upload was exercised on Android specifically, since that is the
platform it failed on: the attachment reached the homeserver as `m.image`, 86
bytes with a PNG signature, and downloaded back through the authenticated
media endpoint, with no `Network request failed` in logcat. The encryption
toggle is inert on both — on Android not one pixel of the switch changed after
a tap. SC-12 still holds: with the keyboard open the composer stays above it
and the timeline resizes.

The iOS composer is now driven end to end by injected input, which it appeared
not to be: the blocker was the dev-build LogBox toast overlaying the input row
and absorbing the taps, not anything about iOS. With it dismissed, a typed
message reached the homeserver and the `+` control uploaded an image there —
checked by querying Synapse for the events, not by reading the screen.

## [0.1.0] — unreleased

Never published to npm; superseded by 0.2.0 above, which contains all of it.
Kept as a separate entry because it is where the rewrite is described, and
folding two very different sets of changes into one heading would lose that.

Complete rewrite. Shares no API with the 0.0.x line; see the migration table in
`README.md`.

Versioned below 1.0.0 deliberately. The rewrite is finished and verified, but
the public API has not yet been exercised by an application other than
`example/`, and the items in `memory_bank/backlog.md` are still open. Under
semantic versioning a `0.x` minor may break the API, so a breaking change
arrives as a minor bump rather than a major one — which is exactly what
happened in 0.2.0. Pin the minor if that matters: `^0.2.0` allows patches
only. 1.0.0 is the same API once it has been used in anger.

### Added

- **TypeScript throughout**, `strict` plus `noUncheckedIndexedAccess`. The
  package ships CommonJS, ESM, and declarations, and exposes its sources
  through the `react-native` export condition so Metro reads TypeScript
  directly.
- **`MatrixSession`**, an instantiable session replacing the `Matrix`
  singleton. Several screens can observe one session concurrently
  (ADR-002).
- **Hooks**: `useMatrix`, `useRooms`, `useRoom`, `useTimeline`, `useTyping`,
  `useReceipts`, `useAdapters`, `useMxcImage`, behind `MatrixProvider`.
- **Message editing and deletion** through `m.replace` and
  `m.room.redaction`.
- **Full reactions**: any key, sender aggregation, and removal of your own
  reaction. 0.0.x supported a single hard-coded `liked` key with no way to
  remove it.
- **Typing indicators** with throttled outgoing notifications and an automatic
  stop.
- **Read receipts** exposed per member, in a hook separate from the timeline so
  receipt traffic does not re-render message lists.
- **New content types**: video, location, and thread relations, alongside text,
  image, file, and audio.
- **End-to-end encryption**, opt-in through `crypto.enabled`, with a separate
  `react-native-matrix/crypto` entry point holding `assertCryptoSupport`,
  `getCryptoApi`, `enableRoomEncryption`, and `useRoomEncryption`.
  `undecryptable` is a rendered state rather than a filtered-out event, and a
  missing backend throws `CryptoUnavailableError` naming the missing piece
  rather than starting unencrypted (ADR-003).
- **Default UI components** on React Native primitives only, with no bundled
  images and no icon package: `ChatScreen`, `MessageList`, `MessageRow`,
  `Composer`, `RoomList`, `RoomListItem`, `Avatar`, `ReactionBar`,
  `DaySeparator`, `TypingIndicator`. `MatrixUiProvider` restyles all of them
  from one token object and replaces every string; interpolated labels are
  functions, so a missing argument is a compile error rather than
  `[object Object]`. `DaySeparator` reads `Today` and `Yesterday` from those
  labels and falls back to an `Intl`-formatted date, so the relative words are
  translatable while the date follows the locale.
- **Integration suite** against a real Synapse: login and sync, invites, direct
  rooms, message delivery between two users, edits, redactions, reactions,
  replies, read receipts, typing, pagination, authenticated media upload and
  download, and an encrypted round-trip between two devices.
- **`example/` application** consuming the library from source through Metro,
  wiring two adapters and deliberately leaving the rest unwired.
- **Platform adapters** for image picking, documents, audio, share, clipboard,
  file system, and emoji. A missing adapter hides its control and throws a
  named error when invoked directly.
- **Local echo** with `sending` / `sent` / `failed` states and retry through the
  SDK, so a retried attachment is not re-uploaded.
- **Local Synapse** in Docker with a lifecycle script, for integration tests
  and the example app.

### Changed

- **Zero runtime dependencies.** All twenty-two runtime dependencies of 0.0.x
  are gone (ADR-001). `matrix-js-sdk`, `react`, and `react-native` are peer
  dependencies.
- **All protocol traffic goes through `matrix-js-sdk`.** The parallel `axios`
  REST layer is deleted (ADR-005).
- **Incremental timeline updates.** Only rows affected by an event are rebuilt;
  0.0.x reconstructed every room model on every sync event.
- **Direct rooms are detected from `m.direct` account data** rather than by
  scanning the loaded timeline for an `is_direct` flag that falls out of the
  window as a conversation grows.
- **Unread counts come from the SDK's push rules** instead of being recounted
  locally.

- **Memory bank** (`memory_bank/`): 49 governed documents covering product
  context, domain rules, engineering policy, ops, and five ADRs, with an
  automated index audit wired into `npm run verify`.

### Fixed

Defects carried over from 0.0.12, each with a regression test:

- Event content was copied key-by-key onto model instances whose prototypes had
  getter-only accessors, so any room member could crash every other client in
  the room by sending content with a key named `message` or `type`. Content is
  now parsed through a whitelist.
- Access tokens were appended to the query string of every request, where
  proxies and servers log them. They now travel in the `Authorization` header
  only (ADR-004).
- Media downloads used a non-standard `accessToken` header that homeservers
  ignore, so attachments failed against servers with authenticated media
  enabled.
- A duplicated `messageSent` definition silently disabled read markers for sent
  messages.
- The chat-list sort comparator returned a boolean, so ordering was effectively
  arbitrary.
- Accepting an invite called its own callback with mismatched arguments, so the
  joined room never appeared in the list.
- The Android action sheet used a translation key that did not exist, rendering
  `[object Object]`.
- The reply-fallback parser matched `> ` anywhere in a line, mangling ordinary
  messages containing a comparison such as `2 > 1`.
- Day separators compared elapsed hours instead of calendar days, so messages
  hours apart across midnight showed no separator.
- The keyboard listeners subscribed only to `keyboardWillShow` and
  `keyboardWillHide`, which never fire on Android.
- A custom `renderLike` was invoked but its result discarded, so the default
  reaction UI rendered anyway.
- `renderAddFiles` referenced a method that did not exist, throwing when the
  prop was supplied.
- In the group-edit screen, the save and leave buttons carried each other's
  labels, `exitRoom` read `.status` from a boolean, and a picked image was
  passed to `<Image>` as a bare string.
- A slide-in animation was dead because the incoming style spread overwrote the
  animated `left` value.
- The `postinstall` script rewrote files inside `react-native` and
  `matrix-js-sdk` with no error handling, aborting installation outright. It is
  removed.

Found by the integration suite and the example app, before release:

- Local echo was re-keyed by transaction ID, but the SDK keys a pending event
  as `~<roomId>:<txnId>` and reports the previous ID separately. Every sent
  message rendered twice against a real homeserver. The unit fake had modelled
  the two IDs as equal, which is why the unit suite passed.
- `mxcToHttpUrl` always passed a resize method, and the SDK switches to the
  thumbnail endpoint whenever one is set — so every attachment download
  returned a cropped thumbnail instead of the original file.
- Edits never became visible: the timeline event for an `m.replace` can arrive
  before the SDK attaches it to its target. The reliable signal is
  `MatrixEventEvent.Replaced`.
- An outgoing reaction kept its provisional event ID, which is the ID needed to
  remove it, so a user could not undo their own reaction until the room was
  reopened.
- Redacting a reaction did not update the message it annotated, so a removed
  reaction stayed on screen.
- `m.direct` was read but never written, so no room was ever detected as
  direct. Both the creator and the accepting client now record it.
- The Rust crypto store defaulted to IndexedDB, which React Native does not
  have; the WebAssembly module aborted instead of falling back. The store is
  now selected by probing for the global, overridable with
  `crypto.useIndexedDB`.
- `MatrixProvider` declared `ReactNode` as its return type, which React 18's
  JSX types reject — it could not be used in a consumer's tree.
- `Emitter.on` relied on type narrowing that TypeScript before 5.7 drops inside
  a closure, and two globals were read in a way that required a particular
  `lib` in the consumer's `tsconfig`.

### Removed

- `Matrix` singleton, `MatrixChat`, `MatrixChats`, `MatrixCreateGroupChat`,
  `MatrixEditGroupChat`, the `api/` REST layer, the `trans` translation
  singleton, and the `postinstall` patcher.
- The sixteen PNG icons under `src/assets/`. The default components draw no
  bundled images, so they were dead weight in every consumer's tarball.
- The optional peer dependency on `@matrix-org/matrix-sdk-crypto-wasm`. It was
  redundant and wrong: `matrix-js-sdk` depends on the package directly, and on
  a different major than this declaration required. See the status note in
  ADR-003.

### Known requirements

Stated in full, with versions, under Requirements in `README.md`.

- Applications must import `react-native-get-random-values` before anything
  else. Hermes exposes no Web Crypto and `matrix-js-sdk` needs
  `crypto.getRandomValues` for every transaction ID, so the session throws
  before the first sync. No test run can catch this: Node provides the global
  natively.
- Applications must add `@babel/plugin-transform-export-namespace-from` to
  their `babel.config.js`. `matrix-js-sdk` 42 re-exports namespaces from its
  entry point and the React Native preset carries no plugin that lowers it, so
  Metro fails the bundle. This one fails at build time, not at runtime.
- Below React Native 0.81, applications must also set
  `resolver.unstable_enablePackageExports = true` in `metro.config.js`.
  `@matrix-org/matrix-sdk-crypto-wasm` declares only an `exports` map and
  `matrix-js-sdk` imports it unconditionally, so without package exports the
  bundle fails to resolve it whether or not the app uses encryption. Metro
  0.87 defaults the flag on.
- Below React Native 0.87, applications must also install
  `react-native-url-polyfill`. Older React Native appended a trailing slash to
  every URL it constructed and the homeserver answered `405`.
- Without an IndexedDB polyfill the crypto store is held in memory: room keys
  do not survive a restart, and messages received during a previous run cannot
  be decrypted.

## [0.0.12] — 2021-03-31

Final release of the original JavaScript line. Unmaintained; see the migration
notes in `README.md`.
