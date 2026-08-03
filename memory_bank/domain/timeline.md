---
doc_kind: domain
doc_function: canonical
purpose: How Matrix events become renderable rows, including relations and hostile-content handling.
derived_from:
  - matrix-model.md
status: active
canonical_for:
  - content_parsing_rules
  - renderable_event_rules
  - edit_semantics
  - redaction_semantics
  - reaction_aggregation
  - reply_fallback_handling
---

# Timeline

## Content parsing

Event content is written by whoever sent the event. It is untrusted input.

**Rule: no attacker-controlled string ever becomes a property name.** Fields are read individually and type-checked in `src/timeline/parseContent.ts`. Content that fails a check yields `null`, never a partially built object.

This rule exists because of a concrete defect in 0.0.x. The content model ran `Object.keys(content).map(field => this[field] = content[field])` while its prototype exposed getter-only accessors such as `message` and `type`. Assigning to a getter-only property throws in strict mode, which ES modules always are, so any room member could crash every other client in the room by sending a message whose content included a key named `message`. Regression cases live in `src/timeline/__tests__/parseContent.test.ts`.

## Which events are rendered

| Event | Rendered as |
|-|-|
| `m.room.message` with a known msgtype | The matching `MessageKind` |
| `m.room.message` with an unknown msgtype | `unsupported`, showing the body if there is one |
| `m.room.message` that is an `m.replace` | Not rendered; folded into its target |
| `m.reaction` | Not rendered; aggregated onto its target |
| Redacted event | `redacted` tombstone |
| `m.room.encrypted` that failed to decrypt | `undecryptable` |
| State events | Not rendered by default components |

## Edits

An edit is an `m.replace` relation carrying `m.new_content`. The rendered row keeps the **original** event ID, timestamp, and position, and takes its content from the replacement. `isEdited` is true and `editedTs` carries the replacement's timestamp.

The top-level body of an edit event is a `* fallback` for clients without edit support and is never displayed by this library.

## Redactions

A redacted event keeps its position and identity. Content, media, location, and reply reference are cleared — a client must not display content the sender deleted, even if it is still in a local cache. `redactedBy` names the redacting user when the server reports it.

## Replies

A reply carries `m.in_reply_to` plus a plain-text fallback where quoted lines are prefixed with `> `. The fallback is stripped before rendering, otherwise the quote appears twice. Replies **sent** by this library carry no fallback: it is deprecated in the spec, and copying the quoted text into every reply body makes the original turn up in the recipient's search results and notifications. A client that understands only the fallback shows such a reply without its quote.

Stripping is anchored: only a contiguous run of `> ` lines **at the start** of the body counts, terminated by one blank line. 0.0.x used `indexOf('> ') !== -1`, which mangled ordinary messages containing a comparison such as `2 > 1`.

When the quoted event is outside the loaded window the reference is still rendered, without a preview. Hiding the reply would lose information the sender intended.

## Reactions

Reactions are `m.annotation` relations aggregated per key:

- one sender counts once per key, regardless of duplicates;
- redacted reactions are excluded;
- the current user's own reaction event ID is retained so it can be redacted to remove the reaction;
- ordering is by count descending, then by key, so it is stable across renders.

Any key is supported. 0.0.x hard-coded a single `liked` key, kept its state in component state only, and offered no way to remove a reaction.

## Threads

An `m.thread` relation is exposed as `TimelineItem.thread`, and threaded replies stay in the main timeline. A dedicated thread view is post-1.0.0 work; see [../product/roadmap.md](../product/roadmap.md).

## Ordering and local echo

`TimelineStore` holds rows oldest-first for O(1) appends and exposes a cached newest-first view for inverted lists.

A sent message appears immediately as a local echo keyed by transaction ID. When the homeserver confirms it, the SDK reuses the same event object and swaps its ID, so the row is **re-keyed in place** (`replaceId`) rather than inserted again.
