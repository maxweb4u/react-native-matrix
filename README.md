# react-native-matrix

Typed React Native components and hooks for [Matrix](https://matrix.org) chat.

**Zero runtime dependencies.** Installing this package adds one entry to your
`node_modules`. Camera, file picking, audio, share, and clipboard arrive as
adapters you implement with whatever your app already uses.

> **Status: 0.2.0**, published to npm on 2026-08-30. Everything below is
> implemented, with 332 unit tests and 47 integration tests against a real
> Synapse, and the example app has been run on a physical Android device and an
> iOS simulator on React Native 0.87 with React 19. The version is below 1.0.0 because no application other than
> `example/` has used this API yet; what is still open is in
> [`memory_bank/backlog.md`](memory_bank/backlog.md). Note that under semantic
> versioning a `0.x` minor may break the API, so `^0.2.0` allows patch releases
> only. The 0.0.12 release, which npm served until 0.2.0 replaced it, is
> unrelated to this API and no longer installable; see
> [Migrating from 0.0.x](#migrating-from-00x).

## Requirements

| | Version |
|-|-|
| React Native | 0.81+ (developed and verified against 0.87) |
| React | 19.0+ (developed and verified against 19.2) |
| `matrix-js-sdk` | 42+ (peer dependency, you install it) |
| End-to-end encryption | A JavaScript engine with WebAssembly — see [End-to-end encryption](#end-to-end-encryption) |

## Install

```sh
npm install react-native-matrix matrix-js-sdk
```

There is no postinstall step and nothing to link in this package itself. There
is, however, one polyfill your application must install, because Hermes does
not provide it and `matrix-js-sdk` cannot work without it.

### One required polyfill

```sh
npm install react-native-get-random-values
```

```js
// index.js — before every other import
import 'react-native-get-random-values';
```

Hermes exposes no Web Crypto, and `matrix-js-sdk` calls
`crypto.getRandomValues` to generate the transaction ID of every request.
Without it the session throws `TypeError: Cannot read property
'getRandomValues' of undefined` before the first sync completes. Verified on
React Native 0.87: this is still required.

No test run can catch a missing polyfill, because Node supplies the same
globals natively. Run your app on a device once.

### One required Babel plugin

```sh
npm install --save-dev @babel/plugin-transform-export-namespace-from
```

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
```

`matrix-js-sdk` 42 re-exports namespaces (`export * as ContentHelpers`) from
its compiled entry point. That is standard ES2020, but the React Native preset
ships no plugin that lowers it, so Metro's CommonJS transform rejects the file
and the bundle fails with *Export namespace should be first transformed by
`@babel/plugin-transform-export-namespace-from`* before the app starts.
Measured on React Native 0.87 with `matrix-js-sdk` 42.2.0.

Unlike the polyfill above, this one fails loudly and at build time, so you
cannot ship without noticing.

### `URL`, on React Native below 0.87

Older React Native appended a trailing slash to every URL it constructed, and
`matrix-js-sdk` builds every request through `new URL()`, so `/filter` became
`/filter/` and the homeserver answered `405 M_UNRECOGNIZED`. If you are between the
0.81 floor and 0.87, install `react-native-url-polyfill` and import
`react-native-url-polyfill/auto` alongside the polyfill above. React Native
0.87 no longer needs it.

### Android

If you use the default `<ChatScreen />`, your main activity needs:

```xml
<activity android:windowSoftInputMode="adjustResize" ... >
```

It is the React Native template default. Without it the composer stays under
the keyboard on Android when the window is not edge-to-edge.

From React Native 0.87 the template turns edge-to-edge on
(`edgeToEdgeEnabled=true`), and an edge-to-edge window is **not** resized for
the keyboard, so `adjustResize` alone is no longer enough. `ChatScreen` handles
both: it applies `KeyboardAvoidingView` padding on Android as well as iOS,
which measures as zero when the window does resize.

## Quick start

Authentication stays in your app: log in however you already do, then hand the
credentials to the provider. With the default components, a working chat is
about fifteen lines:

```tsx
import { ChatScreen, MatrixProvider, RoomList } from 'react-native-matrix';

export function App() {
  const [roomId, setRoomId] = useState<string | null>(null);

  return (
    <MatrixProvider credentials={credentials} fallback={<Splash />}>
      {roomId ? (
        <ChatScreen roomId={roomId} />
      ) : (
        <RoomList onSelectRoom={(room) => setRoomId(room.id)} />
      )}
    </MatrixProvider>
  );
}
```

`ChatScreen` is the conversation, the typing indicator, the composer, and the
keyboard handling. `RoomList` is the chat list with invites pinned to the top
and acceptable inline.

## Faster cold starts

By default the session keeps everything in memory, so every launch runs a full
initial sync: the homeserver builds the last `initialSyncLimit` events of every
room and the user waits for it. Give the session somewhere to write and it
resumes from the saved token instead.

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

<MatrixProvider credentials={credentials} syncStorage={AsyncStorage}>
```

`syncStorage` is three methods — `getItem`, `setItem`, `removeItem`, all
returning promises — so `AsyncStorage` fits as-is and MMKV or
`expo-secure-store` need a three-line wrapper. The library does not depend on
any of them; picking the storage is yours.

Two things to know:

- **Clear it on sign-out.** The saved sync holds room state and message bodies
  for the account that wrote it. Call `session.clearPersistedSync()` before a
  different user signs in on the same device.
- **Flush before backgrounding** if you want the next launch to be cheap:
  `session.flush()` writes immediately. The store otherwise writes at most
  every five minutes, because each write serialises the whole accumulated
  sync and that is a pause on the JS thread.

Tune the interval with `syncPersistence={{ writeDelayMs }}`, and the storage
key with `syncPersistence={{ key }}`.

## Building your own UI

The components are optional. Everything they do is available from the hooks:

```tsx
import { MatrixProvider, useRooms, useTimeline } from 'react-native-matrix';

export function App() {
  return (
    <MatrixProvider
      credentials={{
        baseUrl: 'https://matrix.example.org',
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
      }}
      fallback={<Splash />}
    >
      <ChatList />
    </MatrixProvider>
  );
}

function ChatList() {
  const { rooms, totalUnread } = useRooms();
  return (
    <FlatList
      data={rooms}
      keyExtractor={(room) => room.id}
      renderItem={({ item }) => <Row room={item} />}
    />
  );
}

function Chat({ roomId }: { roomId: string }) {
  const { items, hasMore, loadMore, sendText, toggleReaction } = useTimeline(roomId);

  return (
    <FlatList
      inverted
      data={items}
      keyExtractor={(item) => item.id}
      onEndReached={() => hasMore && loadMore()}
      renderItem={({ item }) => <Bubble item={item} onLike={() => toggleReaction(item.id, '👍')} />}
    />
  );
}
```

`items` is newest-first and ready for an inverted list. Every entry is an
immutable `TimelineItem` with the content already parsed, the reply fallback
stripped, edits applied, and reactions aggregated — you never touch raw event
content.

## Hooks

| Hook | Returns |
|-|-|
| `useMatrix()` | `session`, `status`, `userId` |
| `useRooms(options?)` | `rooms`, `totalUnread`, `acceptInvite`, `declineInvite` |
| `useRoom(roomId)` | `room`, `members`, `rename`, `invite`, `leave` |
| `useTimeline(roomId)` | `items`, `loadMore`, `sendText`, `sendFile`, `editText`, `deleteMessage`, `toggleReaction`, `markRead`, `retry` |
| `useTyping(roomId)` | `typingUserIds`, `setTyping` |
| `useReceipts(roomId)` | `readUpTo`, `readersOf` |
| `useRoomNotifications(roomId)` | `level`, `isLoading`, `error`, `setLevel` |
| `useAdapters()` | `has`, `require` |
| `useMxcImage(mxcUri, options?)` | An `<Image>` source with the auth header attached |

Several screens may use the same room at once: the underlying timeline is
shared and reference-counted, so a split view or a stack that keeps screens
mounted works without extra wiring.

## Components

Built on React Native primitives only — no icon package, no gesture library, no
bundled images. The avatar fallback is initials.

| Component | Renders |
|-|-|
| `<ChatScreen roomId />` | The whole conversation screen, keyboard handling included |
| `<MessageList roomId />` | Inverted history with day separators, grouping, and pagination |
| `<Composer roomId />` | Input bar, typing notifications, adapter-gated attachments |
| `<RoomList />` | Chat list with invites pinned and acceptable inline |
| `<MessageRow item />`, `<RoomListItem room />`, `<Avatar />`, `<ReactionBar />`, `<DaySeparator />`, `<TypingIndicator roomId />` | The pieces, for your own layouts |

Theme, strings, and locale come from an optional provider. Without it the
components render with the default palette and English labels, so you can see
the chat working before deciding how to style it.

```tsx
<MatrixUiProvider
  theme={{ colors: { accent: '#7c3aed', bubbleOwn: '#7c3aed' } }}
  labels={{ composerPlaceholder: 'Nachricht', typingOne: (name) => `${name} tippt…` }}
  locale="de-DE"
>
```

Interpolated labels are functions, not templates with placeholders. A missing
argument is a compile error rather than an `[object Object]` on screen — which
is precisely what 0.0.x rendered in its Android action sheet.

## Push notifications

Delivery is yours — FCM, APNs and showing the banner are native work and this
library ships none. Everything between your device token and the homeserver is
here.

```tsx
// Registering. The token comes from the `pushToken` adapter.
await session.registerPusher({
  appId: 'com.example.app.ios',
  gatewayUrl: 'https://push.example.org/_matrix/push/v1/notify', // Sygnal, not your homeserver
  appDisplayName: 'Example',
  deviceDisplayName: 'iPhone',
});

// Sign-out must do this, and must pass appId: a pusher written on an earlier
// launch is unknown to a fresh session, and leaving it registered keeps the
// device waking up for an account the user has left.
await session.unregisterPusher({ appId: 'com.example.app.ios' });
```

A push carries a room ID and an event ID and no message content, so your
background handler fetches the rest. `resolvePushEvent` needs no session,
because a task woken by a push has none:

```tsx
const notification = await resolvePushEvent(credentials, { roomId, eventId });
if (notification.kind === PushEventKind.Encrypted) {
  show(notification.roomName, 'New message'); // cannot be decrypted here
} else if (notification.kind === PushEventKind.Message) {
  show(notification.senderDisplayName, notification.body);
}
```

Per-room settings are `all`, `mentions` or `mute`, through
`useRoomNotifications(roomId)` or `session.setNotificationLevel`. The mapping
onto Matrix push rules — and why `mute` cannot be written the way
`matrix-js-sdk` writes it — is in
[`memory_bank/domain/push.md`](memory_bank/domain/push.md).

## Adapters

Anything needing a native module is an adapter you pass to the provider. All
are optional and independent — an app that only sends text passes none.

```tsx
import { launchImageLibrary } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import messaging from '@react-native-firebase/messaging';

<MatrixProvider
  credentials={credentials}
  adapters={{
    imagePicker: {
      async pickFromLibrary() {
        const { assets } = await launchImageLibrary({ mediaType: 'photo' });
        const asset = assets?.[0];
        return asset?.uri
          ? { uri: asset.uri, name: asset.fileName ?? 'image.jpg', mimeType: asset.type ?? 'image/jpeg' }
          : null;
      },
    },
    clipboard: { setString: (value) => Clipboard.setString(value) },
    pushToken: {
      getToken: () => messaging().getToken(),
      // Without this the pusher is never rewritten when the token rotates,
      // and notifications stop with no error anywhere.
      onTokenRefresh: (listener) => messaging().onTokenRefresh(listener),
    },
  }}
>
```

A missing adapter hides its control in the default UI and throws
`AdapterMissingError` if the feature is invoked directly. It is never a silent
no-op. Full interfaces and more recipes:
[`memory_bank/engineering/adapters.md`](memory_bank/engineering/adapters.md).

## End-to-end encryption

Encryption is opt-in. The backend arrives with `matrix-js-sdk`; what you need
is an engine with WebAssembly and a `deviceId` in the credentials.

**WebAssembly is not available in stock React Native today.** Measured on
0.87.1 with `hermesEnabled=true`, `globalThis.WebAssembly` is `undefined`, so
`isCryptoSupported()` returns false and encryption cannot start on a device.
The encrypted round trip is covered by the integration suite, which runs on
Node. Check `isCryptoSupported()` before offering the feature, and treat it as
unavailable on device until your engine reports otherwise.

```tsx
<MatrixProvider credentials={credentials} crypto={{ enabled: true, storageKey }}>
```

If the engine has no WebAssembly, the credentials carry no `deviceId`, or the
backend fails to initialise, the session throws `CryptoUnavailableError` naming
the missing piece. It never starts unencrypted as a fallback.

Helpers live behind a separate entry point, so an app with no encrypted rooms
does not bundle them:

```ts
import {
  assertCryptoSupport,   // check before offering the feature
  enableRoomEncryption,  // irreversible; confirm with the user first
  getCryptoApi,          // the SDK's CryptoApi, for verification or key-backup UI
  useRoomEncryption,     // { isEncrypted, isCryptoEnabled, enable }
} from 'react-native-matrix/crypto';
```

> **Key persistence.** The crypto store defaults to IndexedDB, which React
> Native does not have, so the session falls back to an in-memory store. Room
> keys then do not survive a restart and earlier encrypted messages become
> undecryptable on that device. Install an IndexedDB polyfill and set
> `crypto.useIndexedDB: true` if you need durable history.

Details: [`memory_bank/domain/encryption.md`](memory_bank/domain/encryption.md).

## Working without the UI layer

The layers are usable independently. If you only want the protocol handling,
take `MatrixSession` and render everything yourself:

```ts
import { MatrixSession } from 'react-native-matrix';

const session = new MatrixSession({ credentials });
await session.start();

const unsubscribe = session.on('timeline', ({ roomId, event }) => { /* … */ });
await session.sendText(roomId, 'hello');
```

## Migrating from 0.0.x

0.2.0 is a complete rewrite and shares no API with the 0.0.x line.

| 0.0.x | 0.2.0 |
|-|-|
| `Matrix.getInstance()` singleton | `new MatrixSession(...)` via `<MatrixProvider>` |
| `<MatrixChats />` | `useRooms()` plus your own list |
| `<MatrixChat roomId />` | `useTimeline(roomId)` plus your own list |
| `<MatrixCreateGroupChat />` | `session.createRoom(...)` |
| `<MatrixEditGroupChat />` | `useRoom(roomId)` |
| Bundled pickers, recorder, emoji grid | [Adapters](#adapters) |
| `trans` prop and `locale` singleton | `<MatrixUiProvider labels={…} locale="…">` |
| Bundled PNG icons in `src/assets` | Removed; the components draw no images |

The 0.0.x line is not maintained. It cannot be installed on current React
Native, its media downloads fail against homeservers with authenticated media,
and it carried a defect that let any room member crash other clients through
crafted event content.

## Example app

[`example/`](example/README.md) is a React Native app that consumes this
library from source. It is also the manual-verification surface for a release.

```sh
npm run synapse:up     # local homeserver in Docker, with seeded accounts
cd example && npm install && npm run ios   # or: npm run android
```

## Not in 0.2.0

Deliberately out of scope, with the seam left in place:

| | Instead |
|-|-|
| Login, registration, SSO UI | Your app obtains credentials; the library takes them |
| Device verification, cross-signing, key backup UI | `getCryptoApi()` from `react-native-matrix/crypto` |
| Receiving pushes and showing notifications | Your messaging library; the pusher, rules and payload resolution are included |
| Thread and space UI | `TimelineItem.thread` carries the relation |
| VoIP | — |

## Documentation

Design intent, domain rules, and architecture decisions live in
[`memory_bank/`](memory_bank/README.md). Start with
[`engineering/architecture.md`](memory_bank/engineering/architecture.md) for the
layering, or [`domain/timeline.md`](memory_bank/domain/timeline.md) for how
events become rows.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
