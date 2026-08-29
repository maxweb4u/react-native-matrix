/**
 * Normalized content types exposed to consumers.
 *
 * Nothing here mirrors raw Matrix event content one-to-one. Raw content is
 * attacker-controlled, so it is parsed into these shapes through an explicit
 * whitelist in `src/timeline/parseContent.ts`.
 *
 * See memory_bank/domain/timeline.md for the mapping rules.
 */

export const MessageKind = {
  Text: 'text',
  Emote: 'emote',
  Notice: 'notice',
  Image: 'image',
  File: 'file',
  Audio: 'audio',
  Video: 'video',
  Location: 'location',
  /** Event was redacted (deleted) by someone. */
  Redacted: 'redacted',
  /** Encrypted event that could not be decrypted with the available keys. */
  UndecryptableEncrypted: 'undecryptable',
  /** A known event type carrying a msgtype this library does not render. */
  Unsupported: 'unsupported',
} as const;

export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

/** Dimensions and metadata for an attachment, as advertised by the sender. */
export interface MediaInfo {
  /** `mxc://` URI. Absent for local echo before the upload completes. */
  mxcUri: string | null;
  /** Local file URI while the attachment is still being uploaded. */
  localUri: string | null;
  mimeType: string | null;
  /** Size in bytes, when the sender advertised one. */
  size: number | null;
  width: number | null;
  height: number | null;
  /** Duration in milliseconds for audio and video. */
  durationMs: number | null;
  /** `mxc://` URI of the thumbnail, when the sender provided one. */
  thumbnailMxcUri: string | null;
  /** Blurhash (MSC2448), when the sender provided one. */
  blurhash: string | null;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  /** Uncertainty radius in metres, when advertised. */
  uncertainty: number | null;
}

/** A quoted message, resolved from `m.in_reply_to`. */
export interface ReplyReference {
  eventId: string;
  /** Resolved lazily: null when the replied-to event is not loaded. */
  sender: string | null;
  senderDisplayName: string | null;
  body: string | null;
}

/** Aggregated reactions for a single key, e.g. all `👍` on one message. */
export interface ReactionSummary {
  /** The reaction key, usually an emoji. */
  key: string;
  count: number;
  /** User IDs that sent this reaction. */
  senders: string[];
  /** True when the current user is among `senders`. */
  reactedByMe: boolean;
  /** Event ID of the current user's own reaction, needed to redact it. */
  myReactionEventId: string | null;
}

export interface ThreadReference {
  rootEventId: string;
  /** Number of replies in the thread, when known. */
  replyCount: number;
}
