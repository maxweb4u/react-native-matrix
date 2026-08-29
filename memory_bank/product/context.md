---
doc_kind: product
doc_function: canonical
purpose: Who the library serves, the problem it solves, and its explicit non-goals.
derived_from:
  - ../dna/principles.md
status: active
canonical_for:
  - target_audience
  - product_scope
  - product_non_goals
---

# Product Context

## Who this is for

React Native teams that need chat inside an existing application and use Matrix as the backend. They already have navigation, a design system, and native modules for camera and files. They want the Matrix parts — sync, timelines, media, encryption — and they want to render them with their own components.

## Problem

Building a Matrix client means handling the sync loop, timeline mutation semantics (edits, redactions, relations), authenticated media, and encryption. `matrix-js-sdk` provides the protocol but no React bindings and no React Native adaptations. Writing that layer per application is repeated, error-prone work.

## What the library provides

1. A typed session wrapper over `matrix-js-sdk` with React Native defaults.
2. Hooks for rooms, timelines, typing, receipts, and reactions.
3. Normalized, immutable view models so consumers never parse raw event content.
4. Default components that are usable out of the box and replaceable piece by piece.
5. Optional end-to-end encryption.

## Non-goals

- **Not a full Matrix client.** No spaces, no VoIP, no widgets, no moderation tooling.
- **Not a design system.** Default components are plain and expected to be restyled or replaced.
- **Not a state manager.** The library does not prescribe Redux, Zustand, or anything else.
- **Not a native module.** It contains no platform code; device capabilities arrive through adapters. See [../engineering/dependency-policy.md](../engineering/dependency-policy.md).
- **Not an auth UI.** Login, registration, and SSO stay with the host application, which passes credentials in.
