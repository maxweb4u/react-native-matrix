---
doc_kind: domain
doc_function: canonical
purpose: Requirements, degraded states, and boundaries of end-to-end encryption support.
derived_from:
  - matrix-model.md
status: active
canonical_for:
  - e2ee_requirements
  - e2ee_degraded_states
  - e2ee_scope
---

# Encryption

## Requirements

End-to-end encryption needs all four:

1. `@matrix-org/matrix-sdk-crypto-wasm` present. As of `matrix-js-sdk` 37 it is a **direct dependency of the SDK**, so it installs with it and nothing extra has to be declared. This is a change from the original plan; see the status note in [ADR-003](../adr/ADR-003-optional-e2ee-backend.md).
2. A JavaScript engine with WebAssembly. Stock React Native does not have one: `globalThis.WebAssembly` was measured `undefined` on 0.87.1 with `hermesEnabled=true`, so encryption cannot start on a device today and is proved only against Node in the integration suite. A WebAssembly-capable engine or a polyfill is required.
3. A `deviceId` in the session credentials. Encryption keys belong to a device, so a session without one cannot participate.
4. `crypto.enabled` set on the session options.

If any is missing, `MatrixSession.start()` throws `CryptoUnavailableError` naming the missing piece. The session does not start unencrypted as a fallback: silently downgrading encryption is a security defect, not a convenience.

`assertCryptoSupport()` from `react-native-matrix/crypto` runs checks 2 and 3 before a session is built, so an application can disable a toggle rather than catch a failed start.

## Key persistence

The Rust crypto store defaults to IndexedDB. **React Native has no IndexedDB**, and the WebAssembly module aborts rather than degrading, so `MatrixSession` selects the store by probing for an `indexedDB` global and passes `useIndexedDB: false` when there is none. `crypto.useIndexedDB` overrides the probe once a host installs a polyfill.

The consequence of an in-memory store is not cosmetic and must be stated to users: room keys do not survive a relaunch. Messages received during the previous run become permanently undecryptable on this device unless the keys are re-shared or restored from key backup, which is host-owned before 1.0.0. An application that needs durable history has to supply an IndexedDB polyfill and set `crypto.useIndexedDB` to `true`.

## Degraded states

| State | Cause | Rendering |
|-|-|-|
| `undecryptable` | Room key not available for that message | Explicit placeholder row, never an empty bubble |
| Historical messages unreadable | Sent before this device joined | Same placeholder; expected, not an error |
| Everything before this launch unreadable | In-memory crypto store, i.e. no IndexedDB | Same placeholder; see [Key persistence](#key-persistence) |
| Unverified device | Sender's device is not cross-signed | Item still renders; verification UI is host-owned |

The `undecryptable` kind exists so the host can render an honest state. 0.0.x filtered out every event without a plain-text `body`, so an encrypted room appeared simply empty.

## Scope

In scope: encrypted room messages and attachments, key sharing between the user's own devices through the SDK, and reporting decryption failures.

Out of scope before 1.0.0: interactive device-verification UI, key backup and recovery UI, and cross-signing management. The `CryptoApi` from the SDK is exposed so a host application can build these itself.
