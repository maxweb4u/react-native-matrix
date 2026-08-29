---
doc_kind: domain
doc_function: canonical
purpose: What this library owns in Matrix push, what it deliberately does not, and the rules that are easy to get wrong.
derived_from:
  - ../engineering/architecture.md
  - ../engineering/dependency-policy.md
status: active
canonical_for:
  - push_notifications
---

# Push

## The split

Matrix push has two halves and this library owns exactly one.

**Delivery is the host's.** FCM on Android, APNs on iOS, and putting a banner on
screen are native work, and this library ships no native code — see
[../engineering/dependency-policy.md](../engineering/dependency-policy.md). The
device token arrives through the `pushToken` adapter and the notification is
displayed by whatever the application already uses.

**Everything between the token and the homeserver is ours**: registering the
pusher, expressing notification rules in terms a user recognises, and turning a
push payload back into something displayable.

## Rules

1. **No adapter and no token are different failures.** `registerPusher` throws
   `AdapterMissingError` when neither a `pushToken` adapter nor an explicit
   `pushkey` was supplied — that is a wiring mistake. It returns null when the
   adapter is present but has no token yet, which is the ordinary state before
   the user grants permission, and it keeps watching so the token registers as
   soon as it arrives. Collapsing the two into one null would make a forgotten
   adapter indistinguishable from an ungranted permission.

2. **A pusher outlives the access token that created it, and it outlives the
   session too.** Signing out without removing it leaves the device waking up
   for an account the user has left. Sign-out must call `unregisterPusher()`
   next to `clearPersistedSync()` — and must pass `{ appId }`, because a
   pusher written on a previous launch is unknown to a fresh session and the
   no-argument form would remove nothing. That is the ordinary case: register
   on launch, sign out days later, after several restarts.

3. **`append: false` does not clean up after a rotated token.** It is narrower
   than it reads: the specification has the homeserver remove pushers with the
   same app ID *and pushkey* registered by other users. A rotated token is a
   different pushkey, so the previous pusher survives and the homeserver keeps
   pushing to a key nothing reads — and nothing reports it; the user simply
   stops receiving notifications. `registerPusher` therefore deletes the
   previous pushkey explicitly, after writing the new one, so a failure in
   between leaves notifications working rather than silenced. Measured against
   Synapse, not assumed: the integration suite fails without the deletion.

4. **The gateway URL is not the homeserver URL.** `data.url` points at the push
   gateway — Sygnal or equivalent. A wrong value is accepted silently and
   pushes go nowhere.

5. **The payload format is `event_id_only`.** The push carries a room ID and an
   event ID and no message content, which keeps message bodies off a
   third-party gateway. The consequence is that the application is woken with
   two identifiers and has to fetch the rest itself — that is what
   `resolvePushEvent` is for.

6. **`resolvePushEvent` runs without a session.** The application may be woken
   into a background task with nothing started. It takes credentials rather
   than a `MatrixSession` and issues plain requests; starting a client would
   begin syncing, which is the last thing a background task should do.

7. **An encrypted push cannot be read here, and says so.** It arrives as
   `m.room.encrypted`, and decrypting needs a crypto backend that no stock
   React Native engine can run — see [encryption.md](encryption.md). It comes
   back as `PushEventKind.Encrypted` with a null body, which is a state the
   host renders as a generic string. A message kind with an empty body would
   render a blank notification instead.

8. **Push content is parsed through the same whitelist as the timeline.** It is
   as attacker-controlled as any other event content, and it is about to be
   handed to the operating system's notification centre.

## Notification levels

The protocol has no notification level. It has push rules of five kinds
evaluated in a fixed order, and the settings an application offers are
combinations of them. The mapping lives in `src/push/notificationLevel.ts`.

| Level | Stored as | Why |
|-|-|-|
| `all` | no rule | The default is to notify; the level is the absence of a rule, so switching to it means deleting, not writing |
| `mentions` | a `room`-kind rule with `dont_notify` | `room` is evaluated below the `override` rules, so `.m.rule.is_user_mention` and `.m.rule.contains_display_name` still fire |
| `mute` | an `override` rule with a `room_id` condition and `dont_notify` | `override` outranks the mention rules, which is the only way to silence them too |

Two consequences worth stating plainly:

- **`MatrixClient.setRoomMutePushRule` does not mute.** It writes a `room`-kind
  rule, so mentions stay audible. In this library's vocabulary that is
  `mentions`. Using it for `mute` gives a muted room that still buzzes on every
  mention.
- **Both kinds are cleared before either is written.** A leftover of the other
  kind reads as one level in a settings screen while the room behaves as the
  other, and nothing in a UI that renders only the current level will show it.

Suppression has two spellings: `dont_notify` and, since the specification moved
on, an empty action list. Both are live in the wild, so both are read. Rooms
silenced by another client are misreported if only one is recognised.

## What is not covered

Delivery itself. Proving that a notification reaches a device needs a running
push gateway and a real FCM or APNs project, neither of which exists in this
repository's test environment. The integration suite covers registration, the
rule shapes on a real homeserver, and payload resolution — everything up to the
gateway, and nothing past it.
