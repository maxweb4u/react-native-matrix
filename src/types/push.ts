/**
 * Push notification types.
 *
 * Matrix push has two halves. Delivery — FCM, APNs, showing the notification —
 * is native work and stays with the host application. Everything between the
 * homeserver and the device token is here: registering a pusher, expressing
 * notification rules in terms a user understands, and turning the identifiers
 * in a push payload back into something renderable.
 *
 * See memory_bank/domain/push.md.
 */

import type { MessageKind } from './content';

/** What a room notifies for. Ordered from loudest to quietest. */
export const NotificationLevel = {
  /** Every message notifies. The default; no rule is stored for it. */
  All: 'all',
  /**
   * Only mentions notify. A `room`-kind rule suppresses ordinary messages,
   * while the `override` rules for mentions still fire — override outranks
   * room in the evaluation order, which is what makes this level work.
   */
  Mentions: 'mentions',
  /**
   * Nothing notifies, mentions included. This needs an `override` rule, not
   * the `room`-kind rule the SDK's own `setRoomMutePushRule` writes: that one
   * leaves mentions audible, so it is "mentions", not "mute".
   */
  Mute: 'mute',
} as const;

export type NotificationLevel = (typeof NotificationLevel)[keyof typeof NotificationLevel];

/** How much of a push payload this library could make sense of. */
export const PushEventKind = {
  /** A message whose body is available. */
  Message: 'message',
  /**
   * An encrypted message. The body is null and stays null: decrypting needs a
   * crypto backend, which no stock React Native engine can run. Show a generic
   * string rather than an empty notification.
   */
  Encrypted: 'encrypted',
  /** A real event that is not a message — a membership change, a state event. */
  Other: 'other',
} as const;

export type PushEventKind = (typeof PushEventKind)[keyof typeof PushEventKind];

/** What a host needs to render one notification. */
export interface PushNotification {
  kind: PushEventKind;
  roomId: string;
  eventId: string;
  /** Falls back to the room ID when the room has no name. */
  roomName: string;
  senderId: string;
  /** Falls back to the user ID when the member is not in room state. */
  senderDisplayName: string;
  /** Null for anything but `PushEventKind.Message`. */
  body: string | null;
  /** Null for anything but `PushEventKind.Message`. */
  messageKind: MessageKind | null;
  ts: number;
}

/** Registration for one device with the homeserver. */
export interface PusherOptions {
  /**
   * Identifies the application to the push gateway. Must match what the
   * gateway is configured for, and differs between platforms — a single value
   * for both means one platform silently receives nothing.
   */
  appId: string;
  /**
   * The push gateway's push endpoint — Sygnal, not the homeserver. Getting
   * this wrong produces no error: the homeserver accepts the pusher and
   * pushes go nowhere.
   */
  gatewayUrl: string;
  /** Shown in the user's list of sessions on other clients. */
  appDisplayName: string;
  deviceDisplayName: string;
  /**
   * The device token. Omit to take it from the `pushToken` adapter, which is
   * the usual case.
   */
  pushkey?: string;
  /** IETF language tag for the notification text. Defaults to `en`. */
  lang?: string;
  /**
   * Payload format. Defaults to `event_id_only`, which sends identifiers and
   * no message content — the format `resolvePushEvent` is built for, and the
   * only one that keeps message bodies off a third-party gateway.
   */
  format?: string;
  /** Passed through to the gateway to select an icon or sound set. */
  brand?: string;
  /**
   * Keep pushers already registered for other tokens. Defaults to false, which
   * replaces them: leaving stale pushers behind is how a device ends up
   * receiving nothing after a token rotation.
   */
  append?: boolean;
}

/** A pusher as the homeserver reports it. */
export interface Pusher {
  appId: string;
  pushkey: string;
  appDisplayName: string;
  deviceDisplayName: string;
  gatewayUrl: string | null;
  lang: string;
  /** Null on homeservers that do not implement the enabled flag. */
  enabled: boolean | null;
  /** Null before the homeserver supports per-device pushers. */
  deviceId: string | null;
}
