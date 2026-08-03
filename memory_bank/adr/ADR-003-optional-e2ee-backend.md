---
doc_kind: adr
doc_function: canonical
purpose: Record the decision to make the encryption backend an optional peer dependency.
derived_from:
  - ../domain/encryption.md
status: active
decision_status: accepted
date: 2026-08-02
---

# ADR-003 — Optional E2EE backend

## Context

0.0.x had no encryption at all. It filtered the timeline to events carrying a plain-text `body`, so an encrypted room rendered as an empty screen with no explanation. Since most Matrix clients now create private rooms encrypted by default, that made the library unusable for its most common case.

`matrix-js-sdk` implements encryption through `@matrix-org/matrix-sdk-crypto-wasm`, the WebAssembly build of the Rust crypto stack. Two facts constrain the decision:

- The package is large and pulls in a WASM binary.
- WebAssembly has not reached stock React Native: `globalThis.WebAssembly` is `undefined` on 0.87.1 with Hermes enabled, measured on a device. Encryption therefore cannot run on a device at all without a WebAssembly-capable engine or a polyfill.

Making it a hard dependency would push a large WASM payload onto every consumer, including those who only need unencrypted rooms, and would break installs on older React Native versions.

## Decision

`@matrix-org/matrix-sdk-crypto-wasm` is an **optional peer dependency**. Encryption is opt-in through `crypto.enabled` on the session options, and the encryption code lives behind a separate `react-native-matrix/crypto` entry point so bundlers can drop it entirely.

When encryption is requested but unavailable — package missing, no WebAssembly, or no `deviceId` — `MatrixSession.start()` throws `CryptoUnavailableError` naming the missing piece. It does **not** start the session unencrypted.

## Consequences

**Positive.** Applications that do not need encryption pay nothing. Applications whose engine has no WebAssembly — which is every stock React Native app today — can still use the library for unencrypted rooms. The failure mode is a named error with instructions rather than an empty screen.

**Negative.** Encryption support depends on the consumer's React Native version, which the library cannot control, and the requirement has to be stated prominently in the README. Two configurations must be tested: with and without the backend.

**Rejected alternative.** Silently continuing without encryption when the backend is absent. Downgrading encryption without telling anyone is a security defect: the user believes messages are protected when they are not.

## Status note — 2026-08-08

One premise turned out to be wrong, found while implementing step 12 of [FT-001](../features/FT-001-typescript-rewrite/implementation-plan.md).

`matrix-js-sdk` 37.5.0 lists `@matrix-org/matrix-sdk-crypto-wasm` in its own `dependencies`, not as an optional or peer dependency. The package therefore installs with the SDK whether or not an application uses encryption, and the optional peer dependency this ADR introduced was both redundant and wrong: it declared `>=15.0.0` while the SDK pins `^14`, so a consumer honouring it would have installed a second, conflicting copy. The declaration has been removed from `package.json`.

What survives the correction:

- Encryption stays **opt-in** through `crypto.enabled`. Initialising the Rust backend costs startup time and storage, and turning it on is a behaviour choice rather than a packaging one.
- The `react-native-matrix/crypto` entry point stays, so *this library's* encryption helpers are not pulled into an application that has no encrypted rooms.
- `CryptoUnavailableError` and the refusal to start unencrypted are unchanged.

What does not:

- "Applications that do not need encryption pay nothing" is no longer true of the WASM payload. That cost is now set by `matrix-js-sdk` and is outside this library's control. Revisit if the SDK makes the dependency optional again.
