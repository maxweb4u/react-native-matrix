---
doc_kind: adr
doc_function: canonical
purpose: Record the decision to replace the Matrix singleton with an instantiable session.
derived_from:
  - ../engineering/architecture.md
status: active
decision_status: accepted
date: 2026-08-02
---

# ADR-002 — Session instance over singleton

## Context

0.0.x exported `Matrix.getInstance()`, a module-level singleton holding the client and exactly two callback slots: `timelineChatCallback` for a chat screen and `timelineChatsCallback` for the chat list.

Three consequences followed from that shape:

1. Mounting a second chat screen overwrote the first screen's callback. A split view on tablet, a tab navigator that keeps screens mounted, or a chat opened over a chat list all left one screen silently not updating.
2. Unmounting any chat screen called `removeTimelineChatCallback()`, detaching the subscription belonging to a screen that was still mounted.
3. Tests could not run in isolation, because the singleton persisted between cases.

## Decision

`MatrixSession` is a class the application instantiates. `MatrixProvider` holds one instance in React context. Subscriptions are sets keyed by event name, and `on()` returns an unsubscribe function that affects only its own listener.

## Consequences

**Positive.** Any number of screens observe the same session safely. Multiple sessions can coexist, which is what lets the integration suite drive two users against one homeserver in a single process. Tests construct a session per case with no reset ritual.

**Negative.** Consumers must render a provider, and code outside the React tree needs the session passed in rather than imported. This is the ordinary cost of removing global state and is accepted.

**Follow-on.** Nothing in the library may reach for a module-level client. Code that needs the session takes it as an argument or reads it from context.
