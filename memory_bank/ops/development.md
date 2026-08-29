---
doc_kind: ops
doc_function: canonical
purpose: Local setup and everyday commands.
derived_from:
  - ../engineering/testing-policy.md
status: active
canonical_for:
  - local_setup
  - everyday_commands
---

# Development

## Requirements

Node 20 or later, and Docker for the integration suite. No global CLI is needed.

## Setup

```sh
npm install
npm run verify
```

## Commands

| Command | Purpose |
|-|-|
| `npm run verify` | Typecheck, lint, and unit tests. Run before handing work over |
| `npm test` | Unit tests only |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run build` | CommonJS, ESM, and declaration output into `lib/` |
| `npm run synapse:up` / `:down` / `:reset` | Local homeserver lifecycle |
| `npm run test:integration` | Integration suite against the local homeserver |

## Example application

`example/` is a React Native app consuming the package from source through Metro. It is the manual-verification surface: adapters, keyboard behaviour, and encryption are checked there before a release.

```sh
npm run synapse:up   # from the repository root; the app has nothing to talk to otherwise

cd example
npm install
npm run ios          # or: npm run android
```

The app points at the local Synapse by default; see [synapse.md](synapse.md) for the seeded accounts and [example/README.md](../../example/README.md) for what to look at while it is running.

There is deliberately no `react-native-matrix` entry in the example's `package.json`. `example/metro.config.js` watches the repository root, resolves the package to `../src`, and pins `react`, `react-native`, and `matrix-js-sdk` to the app's own copies. A second copy of React reached through the root `node_modules` produces hook errors that look like application bugs and are not.

### Android manifest requirement

Any application using the default `ChatScreen` needs `android:windowSoftInputMode="adjustResize"` on its main activity. Without it `KeyboardAvoidingView` has nothing to react to on Android and the composer stays under the keyboard. This is set in the example's manifest and stated in the README, because it is the one thing a consumer has to change outside JavaScript.
