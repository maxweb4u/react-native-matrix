import { EventStatus, EventType, type MatrixEvent, type Room } from 'matrix-js-sdk';

import { MessageKind, type ReplyReference } from '../types/content';
import { SendState, type TimelineItem } from '../types/timeline';
import {
  isMediaKind,
  kindFromMsgType,
  parseBody,
  parseFormattedBody,
  parseLocation,
  parseMediaInfo,
  parseNewContent,
  parseRelation,
} from './parseContent';
import { aggregateReactions } from './reactions';
import { splitReplyFallback } from '../utils/quote';

/**
 * Decides whether an event should appear as a row in the conversation.
 *
 * Relations (reactions, edits) are folded into the event they annotate rather
 * than shown on their own, and state events are not rendered by the default
 * UI. Consumers that want membership changes can render them from the raw
 * event stream.
 */
export function isRenderableEvent(event: MatrixEvent): boolean {
  const type = event.getType();

  if (type === EventType.RoomMessage || type === EventType.RoomMessageEncrypted) {
    const { relType } = parseRelation(event.getContent());
    // An edit is folded into its target; a reply is a normal message.
    return relType !== 'm.replace';
  }
  // A redacted message keeps its original type, so it is still renderable and
  // is displayed as a tombstone.
  return false;
}

function mapSendState(event: MatrixEvent): SendState | null {
  switch (event.status) {
    case EventStatus.SENDING:
    case EventStatus.QUEUED:
    case EventStatus.ENCRYPTING:
      return SendState.Sending;
    case EventStatus.NOT_SENT:
      return SendState.Failed;
    case EventStatus.SENT:
      return SendState.Sent;
    default:
      // A null status means the event came down /sync, i.e. it is confirmed.
      return null;
  }
}

function resolveReply(room: Room, replyToEventId: string | null): ReplyReference | null {
  if (!replyToEventId) {
    return null;
  }
  const target = room.findEventById(replyToEventId);
  if (!target) {
    // The quoted event is outside the loaded window. The reference is still
    // rendered, just without a preview, instead of hiding the reply entirely.
    return { eventId: replyToEventId, sender: null, senderDisplayName: null, body: null };
  }
  const sender = target.getSender() ?? null;
  return {
    eventId: replyToEventId,
    sender,
    senderDisplayName: sender ? (room.getMember(sender)?.name ?? sender) : null,
    body: splitReplyFallback(parseBody(target.getContent())).body,
  };
}

export interface BuildOptions {
  room: Room;
  ownUserId: string;
  /** Skips reaction aggregation, which needs the relations index. */
  skipReactions?: boolean;
}

/**
 * Converts one `MatrixEvent` into an immutable {@link TimelineItem}.
 *
 * Ordering of the checks matters: a redacted event must not be parsed for
 * content, and an undecryptable event has no content to parse at all.
 */
export function buildTimelineItem(event: MatrixEvent, options: BuildOptions): TimelineItem {
  const { room, ownUserId, skipReactions } = options;

  const sender = event.getSender() ?? '';
  const member = sender ? room.getMember(sender) : null;
  const eventId = event.getId() ?? event.getTxnId() ?? '';
  const roomId = event.getRoomId() ?? room.roomId;

  const base = {
    id: eventId,
    txnId: event.getTxnId() ?? null,
    roomId,
    sender,
    senderDisplayName: member?.name ?? sender,
    senderAvatarMxcUri: member?.getMxcAvatarUrl() ?? null,
    isOwn: sender === ownUserId,
    ts: event.getTs(),
    sendState: mapSendState(event),
    sendError: event.status === EventStatus.NOT_SENT ? 'Message could not be sent' : null,
    wasEncrypted: event.isEncrypted(),
    reactions: skipReactions ? [] : aggregateReactions(room, eventId, ownUserId),
  };

  if (event.isRedacted()) {
    const redactedBecause = event.getUnsigned().redacted_because;
    return {
      ...base,
      kind: MessageKind.Redacted,
      body: '',
      formattedBody: null,
      media: null,
      location: null,
      replyTo: null,
      thread: null,
      isEdited: false,
      editedTs: null,
      isRedacted: true,
      redactedBy: (redactedBecause as { sender?: string } | undefined)?.sender ?? null,
    };
  }

  if (event.isDecryptionFailure()) {
    return {
      ...base,
      kind: MessageKind.UndecryptableEncrypted,
      body: '',
      formattedBody: null,
      media: null,
      location: null,
      replyTo: null,
      thread: null,
      isEdited: false,
      editedTs: null,
      isRedacted: false,
      redactedBy: null,
    };
  }

  // An edit replaces the rendered content but keeps the original timestamp and
  // position, which is what users expect from an edited message.
  const replacement = event.replacingEvent();
  const effectiveContent = replacement
    ? (parseNewContent(replacement.getContent()) ?? replacement.getContent())
    : event.getContent();

  const relation = parseRelation(event.getContent());
  const msgtype =
    typeof (effectiveContent as { msgtype?: unknown })?.msgtype === 'string'
      ? ((effectiveContent as { msgtype: string }).msgtype)
      : null;
  const kind = kindFromMsgType(msgtype);

  const rawBody = parseBody(effectiveContent);
  // Strip the plain-text reply fallback so the quote is not rendered twice.
  const body = relation.inReplyToEventId ? splitReplyFallback(rawBody).body : rawBody;

  return {
    ...base,
    kind,
    body,
    formattedBody: parseFormattedBody(effectiveContent),
    media: isMediaKind(kind) ? parseMediaInfo(effectiveContent) : null,
    location: kind === MessageKind.Location ? parseLocation(effectiveContent) : null,
    replyTo: resolveReply(room, relation.inReplyToEventId),
    thread:
      relation.relType === 'm.thread' && relation.relatesToEventId
        ? { rootEventId: relation.relatesToEventId, replyCount: 0 }
        : null,
    isEdited: replacement !== null,
    editedTs: replacement?.getTs() ?? null,
    isRedacted: false,
    redactedBy: null,
  };
}
