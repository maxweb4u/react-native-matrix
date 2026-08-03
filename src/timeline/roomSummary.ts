import { EventType, type MatrixClient, type Room } from 'matrix-js-sdk';

import { MessageKind } from '../types/content';
import type {
  RoomLastMessage,
  RoomMemberSummary,
  RoomMembership,
  RoomSummary,
} from '../types/timeline';
import { isRenderableEvent } from './buildTimelineItem';
import { kindFromMsgType, parseBody } from './parseContent';

/**
 * Maps room IDs to the other participant, read from `m.direct` account data.
 *
 * This is the authoritative source for direct rooms. 0.0.x scanned the loaded
 * timeline slice for an `is_direct` flag on a membership event, which only
 * appears on the original invite — once a conversation grew past the loaded
 * window, direct rooms silently started rendering as group rooms.
 *
 * See memory_bank/domain/matrix-model.md#direct-room-detection.
 */
export function directRoomUserIds(client: MatrixClient): Map<string, string> {
  const mapping = new Map<string, string>();
  const content = client.getAccountData(EventType.Direct)?.getContent<Record<string, unknown>>();
  if (!content) {
    return mapping;
  }
  for (const [userId, roomIds] of Object.entries(content)) {
    if (!Array.isArray(roomIds)) {
      continue;
    }
    for (const roomId of roomIds) {
      if (typeof roomId === 'string' && !mapping.has(roomId)) {
        mapping.set(roomId, userId);
      }
    }
  }
  return mapping;
}

function lastRenderableEvent(room: Room): RoomLastMessage | null {
  const events = room.getLiveTimeline().getEvents();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || !isRenderableEvent(event)) {
      continue;
    }
    const sender = event.getSender() ?? '';
    const content = event.getContent();
    const msgtype = typeof content.msgtype === 'string' ? content.msgtype : null;
    return {
      eventId: event.getId() ?? '',
      sender,
      senderDisplayName: room.getMember(sender)?.name ?? sender,
      body: event.isRedacted() ? '' : parseBody(content),
      kind: event.isRedacted() ? MessageKind.Redacted : kindFromMsgType(msgtype),
      ts: event.getTs(),
      isOwn: sender === room.myUserId,
    };
  }
  return null;
}

export interface RoomSummaryContext {
  client: MatrixClient;
  /** Precomputed direct-room map, so a list build reads account data once. */
  directRooms?: Map<string, string>;
}

/** Builds the chat-list view of a room. Derived, never stored. */
export function buildRoomSummary(room: Room, context: RoomSummaryContext): RoomSummary {
  const { client } = context;
  const directRooms = context.directRooms ?? directRoomUserIds(client);
  const directUserId = directRooms.get(room.roomId) ?? null;

  const avatarMxcUri = directUserId
    ? (room.getMember(directUserId)?.getMxcAvatarUrl() ?? null)
    : (room.currentState
        .getStateEvents(EventType.RoomAvatar, '')
        ?.getContent<{ url?: string }>().url ?? null);

  const lastMessage = lastRenderableEvent(room);

  return {
    id: room.roomId,
    name: room.name,
    avatarMxcUri,
    isDirect: directUserId !== null,
    directUserId,
    membership: room.getMyMembership() as RoomMembership,
    isEncrypted: Boolean(room.currentState.getStateEvents(EventType.RoomEncryption, '')),
    // Any falsy value means zero: the count is undefined before the first sync.
    unreadCount: room.getUnreadNotificationCount() || 0,
    highlightCount: room.getUnreadNotificationCount('highlight' as never) || 0,
    lastActivityTs: lastMessage?.ts ?? room.getLastActiveTimestamp(),
    lastMessage,
    memberCount: room.getJoinedMemberCount(),
  };
}

/** Newest activity first, with pending invites pinned to the top. */
export function sortRoomSummaries(summaries: RoomSummary[]): RoomSummary[] {
  return [...summaries].sort((a, b) => {
    if (a.membership === 'invite' && b.membership !== 'invite') {
      return -1;
    }
    if (b.membership === 'invite' && a.membership !== 'invite') {
      return 1;
    }
    // 0.0.x returned a boolean from this comparator, so the list order was
    // effectively arbitrary. A comparator must return a signed number.
    return b.lastActivityTs - a.lastActivityTs;
  });
}

export function buildMemberSummary(room: Room, userId: string): RoomMemberSummary | null {
  const member = room.getMember(userId);
  if (!member) {
    return null;
  }
  return {
    userId,
    displayName: member.name,
    avatarMxcUri: member.getMxcAvatarUrl() ?? null,
    membership: (member.membership ?? 'leave') as RoomMembership,
    isSelf: userId === room.myUserId,
    powerLevel: member.powerLevel,
  };
}
