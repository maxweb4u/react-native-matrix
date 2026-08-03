---
doc_kind: adr
doc_function: canonical
purpose: Record the decision to publish with no runtime dependencies.
derived_from:
  - ../product/vision.md
status: active
decision_status: accepted
date: 2026-08-02
---

# ADR-001 — Zero runtime dependencies

## Context

Version 0.0.12 declared twenty-two runtime dependencies: image and document pickers, an audio recorder, an emoji grid, a share sheet, `axios`, `moment`, `rxjs`, `fbemitter`, `rn-fetch-blob`, several polyfills, and `matrix-js-sdk` pinned to `^7.0.0`.

By 2026 that set could not be installed into a current React Native project. `react-native-image-picker` had moved from 1.x to 8.x and removed the API in use. `rn-fetch-blob` was archived. `matrix-js-sdk` had reached 42.x, renaming the constants the code imported. A `postinstall` script patched files inside `react-native` and `matrix-js-sdk` with no error handling, so installation aborted outright when those files were not where it expected.

None of these packages was essential to speaking Matrix. Every one of them was a reason the library stopped working.

## Decision

The published package declares zero runtime dependencies.

- Protocol work goes through `matrix-js-sdk`, declared as a peer dependency so the application owns the version.
- Device capabilities are expressed as adapter interfaces the host implements with whatever it already uses.
- Utilities that justified a dependency — date formatting, byte formatting, event emitting, unique IDs — are implemented in the library, each well under a hundred lines.

## Consequences

**Positive.** Installation adds one package. Upgrading React Native or a picker library cannot break this library, because it does not know they exist. The dependency surface cannot rot, since there is nothing to rot. Applications that already own a picker do not ship a second one.

**Negative.** First-time setup requires wiring adapters, which is more work than a batteries-included library. The recipes in [../engineering/adapters.md](../engineering/adapters.md) exist to reduce that cost, and it is paid once per application rather than on every dependency upgrade.

**Follow-on.** Adding a runtime dependency now requires an ADR and must clear the four conditions in [../engineering/dependency-policy.md](../engineering/dependency-policy.md#exception-process).
