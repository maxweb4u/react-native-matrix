---
doc_kind: domain
doc_function: canonical
purpose: Matrix vocabulary as used throughout this library.
derived_from:
  - ../dna/principles.md
status: active
canonical_for:
  - matrix_vocabulary
---

# Domain Glossary

| Term | Meaning here |
|-|-|
| Homeserver | The Matrix server the user authenticates against, identified by its base URL |
| Room | A conversation. Direct messages are rooms with the `is_direct` flag |
| Event | An immutable message or state change. Identified by an event ID beginning with `$` |
| Timeline | The ordered sequence of events in a room |
| Live timeline | The most recent segment, kept in sync by the `/sync` loop |
| Local echo | A message shown before the homeserver confirms it, keyed by transaction ID |
| Relation | An event pointing at another: `m.replace` (edit), `m.annotation` (reaction), `m.thread`, `m.in_reply_to` |
| Redaction | Deletion of an event's content; the event itself remains as a tombstone |
| `mxc://` URI | A media reference resolved to an HTTP URL on the homeserver |
| Sync token | Cursor into the event stream, returned by every `/sync` response |
| Device | One logged-in client instance. Encryption keys belong to devices, not accounts |
| Megolm | The group-encryption algorithm used for room messages |
| Room key | The Megolm session key needed to decrypt a room's messages |
