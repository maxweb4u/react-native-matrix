---
doc_kind: product
doc_function: canonical
purpose: The intended shape of the library and the trade-offs it accepts.
derived_from:
  - context.md
status: active
canonical_for:
  - product_principles
---

# Vision

A Matrix chat layer that a React Native team can adopt in an afternoon and keep for years.

## Principles

1. **Zero runtime dependencies.** Installing the library adds one package. Native capabilities arrive as adapters the host already has. This is the single most important property: the 0.0.x line became uninstallable because it depended on twenty packages that aged out.
2. **Typed contracts over documentation.** Types are checked; prose is not. Every public surface is a TypeScript declaration.
3. **Hostile input assumption.** Event content is written by other users. It is parsed through a whitelist, never copied onto objects.
4. **Replaceable in layers.** Use the components, or the hooks, or just the session. Each layer is useful without the one above it.
5. **Explicit failure.** A missing adapter, an absent crypto backend, or an unsynced room raises a named error that says what to do. Silent no-ops are defects.

## Accepted trade-offs

- Adapters mean more wiring on first use than a batteries-included library. That cost is paid once per application; the alternative was paid on every dependency upgrade.
- Following `matrix-js-sdk` majors is ongoing work. It is a peer dependency so applications control the version and can upgrade without waiting for a release here.
