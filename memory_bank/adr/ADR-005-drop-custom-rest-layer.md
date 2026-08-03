---
doc_kind: adr
doc_function: canonical
purpose: Record the decision to route all protocol traffic through matrix-js-sdk.
derived_from:
  - ../engineering/architecture.md
status: active
decision_status: accepted
date: 2026-08-02
---

# ADR-005 — Drop the custom REST layer

## Context

0.0.x spoke to the homeserver through two independent transports. Some operations used `matrix-js-sdk` (`sendMessage`, `leave`, `invite`, `scrollback`); others went through a hand-written `axios` client covering `createRoom`, `read_markers`, `sendStateEvent`, profile updates, pushers, and media upload and download.

The split produced concrete defects. Rooms created through the REST layer were not in the SDK store until the next sync, so the chat list did not show them. Errors arrived in two different shapes, and the custom error mapper read `data.errorCode` while checking for `data.errcode`, so the Matrix error code was always `undefined`. The layer also carried an unused `/sync` implementation competing conceptually with the SDK's own sync loop.

## Decision

All protocol traffic goes through `matrix-js-sdk`. The `axios` client, the endpoint modules, and the response-mapping layer are deleted. Failures are normalized by `MatrixRequestError.from`, which preserves `httpStatus` and `errcode`.

## Consequences

**Positive.** One store, one cache, one error shape. Operations are reflected in the SDK's room state immediately, so the UI updates without waiting for the next sync. One less transport to keep aligned with the spec.

**Negative.** The library is bound to the SDK's coverage of the Client-Server API. Where the SDK types content more narrowly than the spec allows, a local cast is needed; these are commented at each site.

**Follow-on.** `axios` and the media-fetch dependency leave the dependency list, which is a precondition for [ADR-001](ADR-001-zero-runtime-dependencies.md).
