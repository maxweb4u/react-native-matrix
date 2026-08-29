# react-native-matrix example

A React Native application that consumes the library **from source** in the
repository above it. It is the manual-verification surface for the release
checklist: adapters, keyboard behaviour, and encryption are checked here.

## Run it

From the repository root, start the homeserver first — the app has nothing to
talk to otherwise:

```sh
npm run synapse:up
```

Then:

```sh
cd example
npm install

# iOS
bundle install          # once
bundle exec pod install # once, and after any native dependency change
npm run ios

# Android
npm run android
```

Sign in as `alice` or `bob`; both are seeded by `synapse:up` with the passwords
in [`memory_bank/ops/synapse.md`](../memory_bank/ops/synapse.md). Run the app
twice — once as each user, on a simulator and a device — to see messages,
reactions, typing indicators, and read receipts move between them.

## How the library is wired

There is no `react-native-matrix` entry in `package.json`. `metro.config.js`
watches the repository root and resolves the package to `../src`, and forces
`react`, `react-native`, and `matrix-js-sdk` to this app's copies — two copies
of React produce hook errors that look like application bugs and are not.

One line in that file is **not** specific to this example and every consuming
app needs it:

```js
resolver: {
  unstable_enablePackageExports: true,
}
```

`@matrix-org/matrix-sdk-crypto-wasm` declares only an `exports` map with no
`main`, and `matrix-js-sdk` imports it unconditionally. React Native 0.76 ships
Metro with package exports off, so without this the bundle fails to resolve it
— whether or not the app uses encryption.

The integration itself is small:

| File | What it does |
|-|-|
| `App.tsx` | `MatrixProvider` with credentials, adapters, and optional crypto |
| `src/login.ts` | Password login. The library takes credentials; obtaining them is the app's job |
| `src/adapters.ts` | The platform adapters, and what a real image picker looks like |
| `src/RoomsScreen.tsx` | `<RoomList />` plus a header |
| `src/ConversationScreen.tsx` | `<ChatScreen />` plus a header |

## What to look at

- **Missing adapters.** Only `imagePicker` and `share` are wired. The composer
  shows the photo control and hides the document and voice controls — a missing
  adapter is never a silent no-op.
- **Keyboard (SC-12).** Focus the composer on Android *and* iOS: the
  conversation must resize and stay scrolled to the newest message. Android
  needs `android:windowSoftInputMode="adjustResize"`, which is already set in
  `android/app/src/main/AndroidManifest.xml`.
- **Encryption.** Toggle it on at sign-in and open a room encrypted with the
  "Encrypt" action. Without an IndexedDB polyfill the crypto store is in
  memory, so room keys do not survive a restart — this is expected and is
  described in [`memory_bank/domain/encryption.md`](../memory_bank/domain/encryption.md#key-persistence).
- **Theming.** `MatrixUiProvider` in `App.tsx` restyles the whole chat from one
  object.

## Notes

- The Android emulator reaches the host through `10.0.2.2`, not `localhost`;
  `src/config.ts` handles that.
- Cleartext HTTP to the local homeserver works in debug builds only: Android
  through the debug manifest, iOS through `NSAllowsLocalNetworking`.
- This app has no automated tests on purpose. Its whole reason to exist is the
  things a test cannot check.
