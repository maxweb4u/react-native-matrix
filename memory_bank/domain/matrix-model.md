---
doc_kind: domain
doc_function: canonical
purpose: How Matrix rooms and membership map onto the library's view models.
derived_from:
  - glossary.md
status: active
canonical_for:
  - room_summary_rules
  - direct_room_detection
  - unread_count_source
---

# Matrix Model

## RoomSummary

`RoomSummary` is what a chat-list row needs and nothing more. It is derived from the SDK `Room`, never stored independently, so it cannot drift from the SDK's state.

| Field | Source |
|-|-|
| `name` | `room.name`, which already applies the spec's naming fallbacks |
| `avatarMxcUri` | Room avatar state event; for direct rooms, the other member's avatar |
| `unreadCount` | `room.getUnreadNotificationCount()` |
| `lastActivityTs` | Timestamp of the newest renderable event |
| `isEncrypted` | Presence of the `m.room.encryption` state event |

## Direct room detection

A room is direct when its ID appears in the `m.direct` account data. Membership events are not consulted.

0.0.x searched the loaded timeline slice for an `is_direct` flag on a membership event. That flag only appears on the original invite, which falls out of the loaded window as a conversation grows, so direct rooms silently started rendering as group rooms. Account data is authoritative and always present.

## Unread counts

Unread counts come from the SDK, which applies the user's push rules. The library never counts events itself.

0.0.x recomputed unreads by walking the timeline and comparing senders to `myUserId`. Because the room model was often constructed without a user ID, the comparison always succeeded and the user's own messages inflated their own unread badge.

## Membership

`RoomMembership` mirrors the spec: `join`, `invite`, `leave`, `ban`, `knock`. Invites appear in the chat list so they can be accepted or declined; `leave` and `ban` rooms are excluded.
