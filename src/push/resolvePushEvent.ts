/**
 * Turns a push payload into something a host can display.
 *
 * A push in the default `event_id_only` format carries a room ID and an event
 * ID and nothing else — deliberately, so message bodies never reach a
 * third-party gateway. The consequence is that the application is woken with
 * two identifiers and has to fetch the rest itself.
 *
 * This runs **without a session**. The application may be woken into a
 * background task with no sync loop, no store, and nothing started, so it
 * takes credentials rather than a `MatrixSession` and issues three plain
 * requests. Starting a client here would begin syncing, which is the last
 * thing a background task should do.
 */

import { createClient, EventType, type IEvent, type MatrixClient } from 'matrix-js-sdk';

import { MatrixRequestError } from '../core/errors';
import { kindFromMsgType, parseBody } from '../timeline/parseContent';
import type { SessionCredentials } from '../types/session';
import { PushEventKind, type PushNotification } from '../types/push';

export interface PushPayload {
  roomId: string;
  eventId: string;
}

/**
 * Fetches the room name, tolerating every reason it may be absent: a room can
 * have no name, and a background token can lack permission to read state.
 */
async function readRoomName(client: MatrixClient, roomId: string): Promise<string | null> {
  try {
    const content = await client.getStateEvent(roomId, EventType.RoomName, '');
    return typeof content?.name === 'string' && content.name.length > 0 ? content.name : null;
  } catch {
    return null;
  }
}

async function readSenderName(
  client: MatrixClient,
  roomId: string,
  userId: string,
): Promise<string | null> {
  try {
    const content = await client.getStateEvent(roomId, EventType.RoomMember, userId);
    return typeof content?.displayname === 'string' && content.displayname.length > 0
      ? content.displayname
      : null;
  } catch {
    return null;
  }
}

/** Room and sender names, each already reduced to what could be read. */
export interface PushEventContext {
  roomName: string | null;
  senderDisplayName: string | null;
}

/**
 * Maps a fetched event onto a notification.
 *
 * Separate from the fetching so the mapping — which is the part with branches
 * and fallbacks — is unit-testable without standing in for the SDK. Testing it
 * through a fake client would prove the fake behaves; see
 * memory_bank/engineering/testing-policy.md.
 */
export function buildPushNotification(
  payload: PushPayload,
  event: Partial<IEvent>,
  context: PushEventContext,
): PushNotification {
  const senderId = typeof event.sender === 'string' ? event.sender : '';
  const base = {
    roomId: payload.roomId,
    eventId: payload.eventId,
    roomName: context.roomName ?? payload.roomId,
    senderId,
    senderDisplayName: context.senderDisplayName ?? senderId,
    ts: typeof event.origin_server_ts === 'number' ? event.origin_server_ts : 0,
  };

  // Encrypted first: the event type is m.room.encrypted and carries only
  // ciphertext. There is no crypto backend in a background task on any stock
  // React Native engine, so this can never become a body here.
  if (event.type === EventType.RoomMessageEncrypted) {
    return { ...base, kind: PushEventKind.Encrypted, body: null, messageKind: null };
  }

  if (event.type !== EventType.RoomMessage) {
    return { ...base, kind: PushEventKind.Other, body: null, messageKind: null };
  }

  const content = event.content ?? {};
  const msgtype = typeof content.msgtype === 'string' ? content.msgtype : null;

  return {
    ...base,
    kind: PushEventKind.Message,
    // Parsed through the same whitelist the timeline uses. Push content is as
    // attacker-controlled as any other event, and it is about to be handed to
    // the operating system's notification centre.
    body: parseBody(content),
    messageKind: kindFromMsgType(msgtype),
  };
}

/**
 * Resolves one push into a renderable notification.
 *
 * The two state lookups are best-effort: a missing room name or display name
 * degrades to the identifier rather than failing the notification, because one
 * saying `!abc:server` still beats none. Failing to read the event itself is
 * not degradable and throws.
 */
export async function resolvePushEvent(
  credentials: SessionCredentials,
  payload: PushPayload,
): Promise<PushNotification> {
  const client = createClient({
    baseUrl: credentials.baseUrl,
    accessToken: credentials.accessToken,
    userId: credentials.userId,
    useAuthorizationHeader: true,
  });

  let event: Partial<IEvent>;
  try {
    event = await client.fetchRoomEvent(payload.roomId, payload.eventId);
  } catch (error) {
    throw MatrixRequestError.from(error);
  }

  const senderId = typeof event.sender === 'string' ? event.sender : '';
  const [roomName, senderDisplayName] = await Promise.all([
    readRoomName(client, payload.roomId),
    senderId ? readSenderName(client, payload.roomId, senderId) : Promise.resolve(null),
  ]);

  return buildPushNotification(payload, event, { roomName, senderDisplayName });
}
