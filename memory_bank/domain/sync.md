---
doc_kind: domain
doc_function: canonical
purpose: How the session syncs, what it persists between launches, and the rules around that stored copy.
derived_from:
  - ../engineering/architecture.md
  - matrix-model.md
status: active
canonical_for:
  - sync_persistence
---

# Sync

The session owns one `/sync` loop, run by `matrix-js-sdk`. Everything the
library renders is derived from what that loop has seen.

## Cold start

By default the client store is `MemoryStore`, so nothing outlives the process.
Every launch is an initial sync: the client asks for the last
`initialSyncLimit` events of every room, and the homeserver builds that
response before the first message can be shown. On an account with many rooms
that is the slowest part of opening the app, and it repeats on every launch.

## Persistence

Passing `syncStorage` to the session swaps in `PersistentSyncStore`, which
accumulates the `/sync` responses and writes them to host-supplied key/value
storage. The next launch restores that snapshot and resumes from its
`next_batch` token, so the first render comes from local data and the
homeserver only has to send what changed.

The SDK ships `IndexedDBStore` for this and React Native has no IndexedDB.
Rather than require a database polyfill, the store subclasses `MemoryStore` the
same way `IndexedDBStore` does and persists through three methods —
`getItem`, `setItem`, `removeItem` — which `AsyncStorage` satisfies as-is.
Picking the storage stays with the host, as with every other native capability
([ADR-001](../adr/ADR-001-zero-runtime-dependencies.md)).

### Rules

1. **The stored copy is account data.** It holds room state, member names, and
   message bodies for the account that wrote it. A different user signing in on
   the same device must not resume from it, so sign-out calls
   `clearPersistedSync()`. This is the host's responsibility; the library
   cannot detect a user switch it was never told about.
2. **It is not encrypted.** The key/value store is whatever the host passed. An
   application handling sensitive conversations should pass an encrypted one —
   `expo-secure-store`, MMKV with an encryption key — not plain `AsyncStorage`.
   Encrypted room keys are a separate store, described in
   [encryption.md](encryption.md#key-persistence).
3. **A write is the whole snapshot.** The accumulated sync is serialised in one
   piece, so writes are throttled to one every five minutes by default. Lower
   `writeDelayMs` and each launch has less to catch up on, at the cost of more
   pauses on the JS thread. `flush()` forces one, which is what to call when
   the application is about to be backgrounded.
4. **Unreadable stored data means a full sync, never a crash.** A payload from
   an older library version, a truncated write, or a storage read that throws
   all resolve the same way: the snapshot is discarded and the launch behaves
   as if there were none. A slow start is a cost; a crash at startup on a
   user's device is a defect.
5. **Storage failures do not reach the sync loop.** A failed write is reported
   through the session's `onError` and leaves the data dirty, so the next write
   retries. Sync keeps running.

## What is not persisted

Local echo, timeline subscriptions, and typing state are per-run. Encrypted
room keys have their own store and their own rules; without an IndexedDB
polyfill they do not survive a relaunch at all, which is a separate limitation
from this one — see [encryption.md](encryption.md#key-persistence).
