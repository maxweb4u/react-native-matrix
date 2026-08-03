---
doc_kind: engineering
doc_function: canonical
purpose: Module boundaries, session ownership, and how updates flow from sync to render.
derived_from:
  - ../product/vision.md
status: active
canonical_for:
  - module_layering
  - session_ownership
  - update_flow
  - public_api_surface
---

# Architecture

## Layers

```
src/types/       Public type declarations. No logic, no imports from other layers.
src/utils/       Pure helpers: dates, formatting, reply fallbacks. No SDK imports.
src/core/        Session, emitter, mxc resolution, errors. Wraps matrix-js-sdk.
src/timeline/    Event → view-model transformation and the ordered store.
src/react/       Provider and hooks. The only layer that knows about React state.
src/components/  Default UI on React Native primitives.
src/crypto/      Optional encryption module, imported through the `./crypto` entry point.
```

Dependencies point downward only. `src/timeline` may import `src/utils`; `src/utils` may not import `src/timeline`. A component never imports the SDK directly — it goes through hooks.

## Session ownership

`MatrixSession` is an instance, not a singleton, and it is the only object that talks to `matrix-js-sdk`.

0.0.x exported `Matrix.getInstance()` with exactly two callback slots, `timelineChatCallback` and `timelineChatsCallback`. Mounting a second chat screen overwrote the first screen's callback, and unmounting either one detached both. A split view, a tab navigator that keeps screens mounted, or a modal chat over a chat list all broke silently. Tests could not run in isolation either, because module state persisted between cases.

Subscriptions are now sets. Any number of screens may observe the same session, and unsubscribing affects only the caller. Multiple sessions can coexist, which is what makes the integration suite able to drive two users against one homeserver.

## Update flow

```
matrix-js-sdk event
  → MatrixSession listener (single place that knows SDK event names)
  → Emitter, typed by room
  → hook subscribed to that room only
  → TimelineStore incremental mutation
  → version bump
  → useSyncExternalStore re-render
```

Two properties are load-bearing:

1. **Room-scoped fan-out.** A message in room A never wakes a screen rendering room B.
2. **Incremental mutation.** Only the affected row is rebuilt. 0.0.x reconstructed the entire room model — every event and content object in the room — on every incoming sync event, for every room in the list.

## Public API surface

Everything exported from `src/index.ts` is a published contract, plus the adapter interfaces and the `./crypto` entry point. Adding to it is a minor release; changing or removing from it is a major one. Internal modules are not exported even when they would be useful, because exporting them makes them permanent.
