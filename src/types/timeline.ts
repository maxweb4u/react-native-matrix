import type {
  GeoPosition,
  MediaInfo,
  MessageKind,
  ReactionSummary,
  ReplyReference,
  ThreadReference,
} from './content';

/** Delivery state of a message the local user sent. */
export const SendState = {
  /** Waiting for the homeserver to acknowledge the event. */
  Sending: 'sending',
  Sent: 'sent',
  Failed: 'failed',
} as const;

export type SendState = (typeof SendState)[keyof typeof SendState];

/**
 * One renderable row of a conversation.
 *
 * A `TimelineItem` is immutable: any change (edit, redaction, new reaction,
 * successful send) produces a new object so React can compare by reference.
 */
export interface TimelineItem {
  /** Event ID, or a local transaction ID while the event is still sending. */
  readonly id: string;
  /** Transaction ID for local echo, so the remote event can replace it. */
  readonly txnId: string | null;
  readonly roomId: string;
  readonly sender: string;
  readonly senderDisplayName: string;
  /** `mxc://` URI of the sender avatar, or null. */
  readonly senderAvatarMxcUri: string | null;
  readonly isOwn: boolean;
  /** Origin server timestamp in milliseconds. */
  readonly ts: number;
  readonly kind: MessageKind;
  /** Plain-text body. Empty string for kinds that carry no text. */
  readonly body: string;
  /** Set when the sender provided `org.matrix.custom.html` formatting. */
  readonly formattedBody: string | null;
  readonly media: MediaInfo | null;
  readonly location: GeoPosition | null;
  readonly replyTo: ReplyReference | null;
  readonly thread: ThreadReference | null;
  readonly reactions: readonly ReactionSummary[];
  readonly isEdited: boolean;
  /** Timestamp of the most recent edit, when edited. */
  readonly editedTs: number | null;
  readonly isRedacted: boolean;
  /** User who redacted the event, when known. */
  readonly redactedBy: string | null;
  readonly sendState: SendState | null;
  /** Set when `sendState` is `failed`. */
  readonly sendError: string | null;
  /** True when this event arrived encrypted and was successfully decrypted. */
  readonly wasEncrypted: boolean;
}

/** A conversation as shown in a chat list. */
export interface RoomSummary {
  readonly id: string;
  readonly name: string;
  /** `mxc://` URI of the room avatar, or null. */
  readonly avatarMxcUri: string | null;
  readonly isDirect: boolean;
  /** For direct rooms, the other participant. Null otherwise. */
  readonly directUserId: string | null;
  readonly membership: RoomMembership;
  readonly isEncrypted: boolean;
  readonly unreadCount: number;
  readonly highlightCount: number;
  /** Timestamp of the newest event, used for ordering. */
  readonly lastActivityTs: number;
  /** Preview of the newest renderable message, or null for an empty room. */
  readonly lastMessage: RoomLastMessage | null;
  readonly memberCount: number;
}

export interface RoomLastMessage {
  readonly eventId: string;
  readonly sender: string;
  readonly senderDisplayName: string;
  readonly body: string;
  readonly kind: MessageKind;
  readonly ts: number;
  readonly isOwn: boolean;
}

export const RoomMembership = {
  Join: 'join',
  Invite: 'invite',
  Leave: 'leave',
  Ban: 'ban',
  Knock: 'knock',
} as const;

export type RoomMembership = (typeof RoomMembership)[keyof typeof RoomMembership];

export interface RoomMemberSummary {
  readonly userId: string;
  readonly displayName: string;
  readonly avatarMxcUri: string | null;
  readonly membership: RoomMembership;
  readonly isSelf: boolean;
  /** Power level in the room; 100 is admin, 50 moderator, 0 default. */
  readonly powerLevel: number;
}
