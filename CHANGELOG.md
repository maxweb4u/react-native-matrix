# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org) against the public API defined in
`memory_bank/engineering/architecture.md`.

## [Unreleased] — 1.0.0

Complete rewrite. Shares no API with the 0.0.x line; see the migration table in
`README.md`.

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

- **Memory bank** (`memory_bank/`): 48 governed documents covering product
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
  redundant and wrong: `matrix-js-sdk` 37 depends on the package directly, and
  on a different major than this declaration required. See the status note in
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
