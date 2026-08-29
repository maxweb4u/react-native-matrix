---
doc_kind: engineering
doc_function: canonical
purpose: The rule for runtime dependencies and the process for the rare exception.
derived_from:
  - ../product/vision.md
status: active
canonical_for:
  - runtime_dependency_policy
  - peer_dependency_policy
  - dev_dependency_policy
---

# Dependency Policy

## The rule

**The published package declares zero runtime dependencies.** `dependencies` in `package.json` is empty and stays empty.

## Why

0.0.x shipped twenty-two runtime dependencies: pickers, an audio recorder, an emoji grid, a share sheet, an HTTP client, a date library, an observable library, and several polyfills. By 2026 most were unmaintained or had shipped breaking majors, and the package could not be installed into a current React Native project at all. Not one of them was essential to speaking Matrix.

The dependency count, not the code, is what killed the previous line. See [ADR-001](../adr/ADR-001-zero-runtime-dependencies.md).

## Peer dependencies

| Package | Why | Optional |
|-|-|-|
| `react`, `react-native` | The host owns these; two copies would break | no |
| `matrix-js-sdk` | The protocol implementation. A peer so applications control the version and can upgrade independently | no |
| `@matrix-org/matrix-sdk-crypto-wasm` | Encryption backend, large and WASM-bound | yes |

## What replaced the removed packages

| Removed | Replacement |
|-|-|
| `moment` | `Intl.DateTimeFormat`, which Hermes ships with full ICU |
| `axios` | The SDK's own HTTP layer; the library sends no requests of its own |
| `rxjs` | `Emitter` and plain timers |
| `fbemitter`, `events` | `Emitter` |
| `prop-types` | TypeScript |
| `get-uid` | The SDK's transaction IDs |
| `base64-arraybuffer`, `buffer`, `unorm`, `url` | Not needed once the custom REST layer was removed |
| Pickers, recorder, share, clipboard, emoji grid | [Adapters](adapters.md) |
| `react-native-device-info` | `useSafeAreaInsets` is host-owned; the library takes an offset prop |

## Exception process

A runtime dependency may be added only when all hold:

1. The capability cannot be implemented in under roughly 200 lines of dependency-free code.
2. It cannot be expressed as an adapter the host supplies.
3. The package is actively maintained and its major line is stable.
4. An ADR records the decision.

No exception has been granted.

## Dev dependencies

Dev dependencies are unconstrained: they never reach a consumer's node_modules. Keep them current so the toolchain does not age the way the runtime dependencies did.
