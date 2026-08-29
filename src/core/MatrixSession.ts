import {
  ClientEvent,
  createClient,
  EventType,
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
  MsgType,
  type Room,
  RelationType,
  RoomEvent,
  RoomMemberEvent,
  type RoomMember,
  SyncState as SdkSyncState,
} from 'matrix-js-sdk';

import { describeCryptoFailure, hasIndexedDB, missingCryptoRequirement } from './cryptoSupport';
import { Emitter } from './Emitter';
import {
  CryptoUnavailableError,
  MatrixRequestError,
  RoomNotFoundError,
  SessionNotReadyError,
} from './errors';
import type {
  CryptoOptions,
  LocalFile,
  MatrixAdapters,
  SessionOptions,
  SessionStatus,
  SyncState,
  Unsubscribe,
} from '../types';

/** Maps a MIME type to the msgtype the spec defines for it. */
function msgTypeForMimeType(mimeType: string): MsgType {
  if (mimeType.startsWith('image/')) {
    return MsgType.Image;
  }
  if (mimeType.startsWith('video/')) {
    return MsgType.Video;
  }
  if (mimeType.startsWith('audio/')) {
    return MsgType.Audio;
  }
  return MsgType.File;
}

/** Events a session emits. Every one carries the room it belongs to. */
export interface SessionEvents {
  /** Sync state or readiness changed. */
  status: SessionStatus;
  /** A live timeline event arrived, was edited, redacted or decrypted. */
  timeline: { roomId: string; event: MatrixEvent; isLive: boolean };
  /** Anything that changes a room's chat-list row. */
  roomSummary: { roomId: string };
  /** The typing member list of a room changed. */
  typing: { roomId: string; userIds: string[] };
  /** A read receipt arrived. */
  receipt: { roomId: string };
  /**
   * The local echo of an outgoing event changed state.
   *
   * `previousEventId` is the ID the event carried before the homeserver
   * confirmed it, which is what lets a store re-key the existing row instead
   * of adding a second one.
   */
  localEcho: { roomId: string; event: MatrixEvent; previousEventId: string | null };
}

const DEFAULT_INITIAL_SYNC_LIMIT = 20;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

/**
 * Owns one authenticated Matrix connection.
 *
 * This replaces the `Matrix` singleton of 0.0.x. Two differences are
 * structural rather than cosmetic:
 *
 * 1. It is a normal class. An application can run several sessions, and tests
 *    do not have to reset module-level state between cases.
 * 2. Subscriptions are sets, not two single callback slots. In 0.0.x mounting
 *    a second chat screen overwrote the first screen's callback and unmounting
 *    either one detached both, so a split view or a stack that keeps screens
 *    mounted silently stopped receiving events.
 *
 * See memory_bank/engineering/architecture.md#session-ownership.
 */
export class MatrixSession {
  private readonly emitter: Emitter<SessionEvents>;

  private readonly options: SessionOptions;

  private client: MatrixClient | null = null;

  private status: SessionStatus = {
    syncState: 'initial',
    isReady: false,
    totalUnread: 0,
    error: null,
    isCryptoEnabled: false,
  };

  private detachers: Unsubscribe[] = [];

  private stopped = false;

  public constructor(options: SessionOptions) {
    this.options = options;
    this.emitter = new Emitter<SessionEvents>((error) => this.reportError(error));
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Creates the underlying client, initialises crypto when requested and waits
   * for the first sync to complete.
   *
   * @throws CryptoUnavailableError when `crypto.enabled` is set but the
   * WebAssembly backend is missing. The session is left stopped in that case
   * rather than silently running without encryption.
   */
  public async start(): Promise<void> {
    if (this.client) {
      return;
    }
    const { credentials, initialSyncLimit, pollTimeoutMs, crypto } = this.options;

    this.client = createClient({
      baseUrl: credentials.baseUrl,
      accessToken: credentials.accessToken,
      userId: credentials.userId,
      deviceId: credentials.deviceId,
      // The access token travels in the Authorization header. 0.0.x appended
      // it to the query string of every request, where proxies log it.
      useAuthorizationHeader: true,
    });

    if (crypto?.enabled) {
      await this.initCrypto(crypto);
    }

    this.attachListeners();

    await this.client.startClient({
      initialSyncLimit: initialSyncLimit ?? DEFAULT_INITIAL_SYNC_LIMIT,
      pollTimeout: pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
    });

    await this.waitForInitialSync();
  }

  /** Stops syncing and releases every listener. Safe to call more than once. */
  public stop(): void {
    this.stopped = true;
    for (const detach of this.detachers) {
      detach();
    }
    this.detachers = [];
    this.client?.stopClient();
    this.emitter.removeAll();
    this.setStatus({ syncState: 'stopped', isReady: false });
  }

  private async initCrypto(crypto: CryptoOptions): Promise<void> {
    const client = this.requireClient('initialise encryption');

    const missing = missingCryptoRequirement(this.options.credentials.deviceId);
    if (missing) {
      throw new CryptoUnavailableError(missing);
    }

    // The SDK defaults to an IndexedDB-backed store, and React Native has no
    // IndexedDB — the WebAssembly module aborts rather than falling back, so
    // encryption would fail on every device the library targets.
    const useIndexedDB = crypto.useIndexedDB ?? hasIndexedDB();

    try {
      await client.initRustCrypto({
        useIndexedDB,
        ...(crypto.storageKey ? { storageKey: crypto.storageKey } : {}),
      });
      this.setStatus({ isCryptoEnabled: true });
    } catch (error) {
      // The session is left stopped rather than continuing unencrypted:
      // silently downgrading encryption is a security defect, not a fallback.
      // See memory_bank/adr/ADR-003-optional-e2ee-backend.md.
      throw new CryptoUnavailableError(
        describeCryptoFailure(error),
        error instanceof Error ? error : null,
      );
    }
  }

  private waitForInitialSync(): Promise<void> {
    const client = this.requireClient('wait for the initial sync');
    if (this.status.isReady) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const onSync = (state: SdkSyncState, _prev: SdkSyncState | null, data?: { error?: Error }) => {
        if (state === SdkSyncState.Prepared || state === SdkSyncState.Syncing) {
          client.off(ClientEvent.Sync, onSync);
          resolve();
        } else if (state === SdkSyncState.Error && data?.error) {
          // A recoverable sync error still retries in the background, so this
          // only rejects the initial wait, never the session itself.
          client.off(ClientEvent.Sync, onSync);
          reject(MatrixRequestError.from(data.error));
        }
      };
      client.on(ClientEvent.Sync, onSync);
    });
  }

  // ---------------------------------------------------------------- listeners

  private attachListeners(): void {
    const client = this.requireClient('attach listeners');

    const onSync = (state: SdkSyncState, _prev: SdkSyncState | null, data?: { error?: Error }) => {
      const mapped: SyncState =
        state === SdkSyncState.Prepared || state === SdkSyncState.Syncing
          ? 'syncing'
          : state === SdkSyncState.Reconnecting || state === SdkSyncState.Catchup
            ? 'reconnecting'
            : state === SdkSyncState.Error
              ? 'error'
              : state === SdkSyncState.Stopped
                ? 'stopped'
                : 'initial';
      this.setStatus({
        syncState: mapped,
        isReady: mapped === 'syncing' || this.status.isReady,
        error: data?.error ?? null,
        totalUnread: this.computeTotalUnread(),
      });
    };

    const onTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
    ) => {
      if (!room) {
        return;
      }
      this.emitter.emit('timeline', {
        roomId: room.roomId,
        event,
        isLive: toStartOfTimeline !== true,
      });
      this.emitRoomSummary(room.roomId);
    };

    const onRedaction = (event: MatrixEvent, room: Room | undefined) => {
      if (!room) {
        return;
      }
      this.emitter.emit('timeline', { roomId: room.roomId, event, isLive: true });
      this.emitRoomSummary(room.roomId);
    };

    const onDecrypted = (event: MatrixEvent) => {
      const roomId = event.getRoomId();
      if (!roomId) {
        return;
      }
      this.emitter.emit('timeline', { roomId, event, isLive: true });
      this.emitRoomSummary(roomId);
    };

    // The SDK reuses the event object and swaps its ID when the homeserver
    // confirms an outgoing event, reporting the previous ID as the third
    // argument. Dropping it is what leaves a sent message on screen twice.
    const onLocalEcho = (event: MatrixEvent, room: Room | undefined, oldEventId?: string) => {
      if (!room) {
        return;
      }
      this.emitter.emit('localEcho', {
        roomId: room.roomId,
        event,
        previousEventId: oldEventId ?? null,
      });
    };

    // An edit does not arrive as a row of its own: the SDK applies it to the
    // event it replaces and announces that through this event. Without it an
    // edit stays invisible until the room is reopened.
    const onReplaced = (event: MatrixEvent) => {
      const roomId = event.getRoomId();
      if (!roomId) {
        return;
      }
      this.emitter.emit('timeline', { roomId, event, isLive: true });
      this.emitRoomSummary(roomId);
    };

    const onReceipt = (_event: MatrixEvent, room: Room | undefined) => {
      if (!room) {
        return;
      }
      this.emitter.emit('receipt', { roomId: room.roomId });
      this.emitRoomSummary(room.roomId);
    };

    const onTyping = (_event: MatrixEvent, member: RoomMember) => {
      const room = client.getRoom(member.roomId);
      if (!room) {
        return;
      }
      const userIds = room
        .getMembers()
        .filter((candidate) => candidate.typing && candidate.userId !== this.userId)
        .map((candidate) => candidate.userId);
      this.emitter.emit('typing', { roomId: member.roomId, userIds });
    };

    const onRoomChanged = (room: Room) => this.emitRoomSummary(room.roomId);
    const onMembership = (room: Room) => this.emitRoomSummary(room.roomId);

    client.on(ClientEvent.Sync, onSync);
    client.on(RoomEvent.Timeline, onTimeline);
    client.on(RoomEvent.Redaction, onRedaction);
    client.on(RoomEvent.LocalEchoUpdated, onLocalEcho);
    client.on(RoomEvent.Receipt, onReceipt);
    client.on(RoomEvent.Name, onRoomChanged);
    client.on(RoomEvent.MyMembership, onMembership);
    client.on(RoomMemberEvent.Typing, onTyping);
    client.on(MatrixEventEvent.Decrypted, onDecrypted);
    client.on(MatrixEventEvent.Replaced, onReplaced);

    this.detachers.push(
      () => client.off(ClientEvent.Sync, onSync),
      () => client.off(RoomEvent.Timeline, onTimeline),
      () => client.off(RoomEvent.Redaction, onRedaction),
      () => client.off(RoomEvent.LocalEchoUpdated, onLocalEcho),
      () => client.off(RoomEvent.Receipt, onReceipt),
      () => client.off(RoomEvent.Name, onRoomChanged),
      () => client.off(RoomEvent.MyMembership, onMembership),
      () => client.off(RoomMemberEvent.Typing, onTyping),
      () => client.off(MatrixEventEvent.Decrypted, onDecrypted),
      () => client.off(MatrixEventEvent.Replaced, onReplaced),
    );
  }

  private emitRoomSummary(roomId: string): void {
    this.emitter.emit('roomSummary', { roomId });
    const totalUnread = this.computeTotalUnread();
    if (totalUnread !== this.status.totalUnread) {
      this.setStatus({ totalUnread });
    }
  }

  private setStatus(patch: Partial<SessionStatus>): void {
    this.status = { ...this.status, ...patch };
    this.emitter.emit('status', this.status);
  }

  private computeTotalUnread(): number {
    if (!this.client) {
      return 0;
    }
    return this.client
      .getVisibleRooms()
      .reduce((total, room) => total + (room.getUnreadNotificationCount() || 0), 0);
  }

  private reportError(error: Error): void {
    this.options.onError?.(error);
  }

  // ------------------------------------------------------------------ getters

  public get userId(): string {
    return this.options.credentials.userId;
  }

  public get adapters(): MatrixAdapters {
    return this.options.adapters ?? {};
  }

  public getStatus(): SessionStatus {
    return this.status;
  }

  /** The underlying SDK client. Prefer the typed helpers on this class. */
  public getClient(): MatrixClient {
    return this.requireClient('access the client');
  }

  public isOwnUser(userId: string): boolean {
    return userId === this.userId;
  }

  public getRoom(roomId: string): Room {
    const room = this.requireClient('read a room').getRoom(roomId);
    if (!room) {
      throw new RoomNotFoundError(roomId);
    }
    return room;
  }

  public getRooms(): Room[] {
    return this.client?.getVisibleRooms() ?? [];
  }

  public isRoomEncrypted(roomId: string): boolean {
    const room = this.client?.getRoom(roomId);
    if (!room) {
      return false;
    }
    return Boolean(
      room.currentState.getStateEvents(EventType.RoomEncryption, ''),
    );
  }

  public on<K extends keyof SessionEvents>(
    event: K,
    listener: (payload: SessionEvents[K]) => void,
  ): Unsubscribe {
    return this.emitter.on(event, listener);
  }

  private requireClient(operation: string): MatrixClient {
    if (!this.client || this.stopped) {
      throw new SessionNotReadyError(operation);
    }
    return this.client;
  }

  // ------------------------------------------------------------------ actions

  /** Sends a plain-text message, optionally as a reply to another event. */
  public async sendText(
    roomId: string,
    body: string,
    options: { replyToEventId?: string; threadRootId?: string } = {},
  ): Promise<string> {
    const client = this.requireClient('send a message');
    const content: Record<string, unknown> = { msgtype: MsgType.Text, body };

    if (options.replyToEventId) {
      content['m.relates_to'] = {
        'm.in_reply_to': { event_id: options.replyToEventId },
      };
    }
    if (options.threadRootId) {
      content['m.relates_to'] = {
        ...(content['m.relates_to'] as object | undefined),
        rel_type: RelationType.Thread,
        event_id: options.threadRootId,
        is_falling_back: true,
      };
    }

    const response = await client.sendMessage(
      roomId,
      options.threadRootId ?? null,
      content as never,
    );
    return response.event_id;
  }

  /**
   * Uploads a local file and sends it as an attachment.
   *
   * The file is read through `fetch`, which handles `file://`, `content://`,
   * and `ph://` URIs in React Native. No file-system dependency is needed for
   * the common case; the `fileSystem` adapter exists only for pickers that
   * cannot hand back a fetchable URI.
   */
  public async sendFile(
    roomId: string,
    file: LocalFile,
    options: { replyToEventId?: string; threadRootId?: string } = {},
  ): Promise<string> {
    const client = this.requireClient('send a file');

    const response = await fetch(file.uri);
    if (!response.ok) {
      throw new MatrixRequestError(
        `Could not read ${file.uri} (HTTP ${response.status})`,
        response.status,
        null,
      );
    }
    const blob = await response.blob();

    const upload = await client.uploadContent(blob as never, {
      name: file.name,
      type: file.mimeType,
    });

    const info: Record<string, unknown> = { mimetype: file.mimeType, size: file.size ?? blob.size };
    if (file.width !== undefined) {
      info.w = file.width;
    }
    if (file.height !== undefined) {
      info.h = file.height;
    }
    if (file.durationMs !== undefined) {
      info.duration = file.durationMs;
    }

    const content: Record<string, unknown> = {
      msgtype: msgTypeForMimeType(file.mimeType),
      body: file.name,
      url: upload.content_uri,
      info,
    };

    if (options.replyToEventId) {
      content['m.relates_to'] = { 'm.in_reply_to': { event_id: options.replyToEventId } };
    }

    const sent = await client.sendMessage(
      roomId,
      options.threadRootId ?? null,
      content as never,
    );
    return sent.event_id;
  }

  /**
   * Retries an event whose send failed.
   *
   * The SDK owns the retry, so an attachment is not re-uploaded and the
   * original transaction ID is preserved — the message cannot be duplicated.
   */
  public async retrySend(roomId: string, eventId: string): Promise<void> {
    const client = this.requireClient('retry a message');
    const room = this.getRoom(roomId);
    const event = room.findEventById(eventId);
    if (!event) {
      return;
    }
    await client.resendEvent(event, room);
  }

  /**
   * Edits a previously sent message.
   *
   * The new text is sent both as `m.new_content` and, prefixed with `*`, as the
   * fallback body that clients without edit support display.
   */
  public async editText(roomId: string, targetEventId: string, newBody: string): Promise<string> {
    const client = this.requireClient('edit a message');
    const content = {
      msgtype: MsgType.Text,
      body: `* ${newBody}`,
      'm.new_content': { msgtype: MsgType.Text, body: newBody },
      'm.relates_to': { rel_type: RelationType.Replace, event_id: targetEventId },
    };
    const response = await client.sendMessage(roomId, null, content as never);
    return response.event_id;
  }

  /** Redacts (deletes) an event. Works for messages and for reactions. */
  public async redact(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = this.requireClient('delete a message');
    await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined);
  }

  /** Adds a reaction. Reacting twice with the same key is a no-op server-side. */
  public async react(roomId: string, targetEventId: string, key: string): Promise<string> {
    const client = this.requireClient('send a reaction');
    const response = await client.sendEvent(roomId, EventType.Reaction, {
      'm.relates_to': {
        rel_type: RelationType.Annotation,
        event_id: targetEventId,
        key,
      },
    } as never);
    return response.event_id;
  }

  /** Removes one of the current user's own reactions by redacting it. */
  public async unreact(roomId: string, reactionEventId: string): Promise<void> {
    await this.redact(roomId, reactionEventId);
  }

  public async sendTyping(roomId: string, isTyping: boolean, timeoutMs = 4000): Promise<void> {
    const client = this.requireClient('send a typing notification');
    await client.sendTyping(roomId, isTyping, timeoutMs);
  }

  /** Marks the room read up to and including `eventId`. */
  public async markRead(roomId: string, eventId: string): Promise<void> {
    const client = this.requireClient('send a read receipt');
    const event = this.getRoom(roomId).findEventById(eventId);
    if (!event) {
      return;
    }
    await client.sendReadReceipt(event);
  }

  /**
   * Loads older messages.
   *
   * @returns true when more history may still exist, false at the start of the
   * room. Callers use the flag to stop showing a loading spinner.
   */
  public async paginateBack(roomId: string, limit = 30): Promise<boolean> {
    const client = this.requireClient('load earlier messages');
    const room = this.getRoom(roomId);
    const timeline = room.getLiveTimeline();
    return client.paginateEventTimeline(timeline, { backwards: true, limit });
  }

  /**
   * Records a room in `m.direct` account data.
   *
   * The homeserver does not maintain this mapping. `is_direct` on the invite is
   * a hint to the invited client and nothing more, so each side is responsible
   * for its own account data. Direct-room detection reads `m.direct` as
   * authoritative (see `src/timeline/roomSummary.ts`), so without this a room
   * created as direct would render as a group room for the rest of its life.
   */
  private async recordDirectRoom(userId: string, roomId: string): Promise<void> {
    const client = this.requireClient('record a direct room');
    const current =
      client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>() ?? {};
    const existing = Array.isArray(current[userId]) ? current[userId] : [];
    if (existing.includes(roomId)) {
      return;
    }
    await client.setAccountData(EventType.Direct, { ...current, [userId]: [...existing, roomId] });
  }

  public async joinRoom(roomId: string): Promise<void> {
    const client = this.requireClient('join a room');
    // Read the invite before joining: accepting it replaces the membership
    // event, and with it the `is_direct` flag.
    const invite = client.getRoom(roomId)?.getMember(this.userId)?.events.member;
    const isDirect = invite?.getContent<{ is_direct?: boolean }>().is_direct === true;
    const inviter = invite?.getSender() ?? null;

    await client.joinRoom(roomId);

    if (isDirect && inviter) {
      await this.recordDirectRoom(inviter, roomId);
    }
  }

  /** Leaves and forgets a room, so it disappears from the chat list. */
  public async leaveRoom(roomId: string): Promise<void> {
    const client = this.requireClient('leave a room');
    await client.leave(roomId);
    await client.forget(roomId);
  }

  public async createRoom(params: {
    name?: string;
    invite?: string[];
    isDirect?: boolean;
    encrypted?: boolean;
  }): Promise<string> {
    const client = this.requireClient('create a room');
    const initialState = params.encrypted
      ? [
          {
            type: EventType.RoomEncryption,
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ]
      : [];
    const response = await client.createRoom({
      name: params.name,
      invite: params.invite,
      is_direct: params.isDirect ?? false,
      preset: (params.isDirect ? 'trusted_private_chat' : 'private_chat') as never,
      initial_state: initialState as never,
    });

    // The creator records the room itself; `is_direct` only reaches the
    // invitee. See recordDirectRoom. A direct room has exactly one other
    // participant, so the first invitee is the one it is direct with.
    const other = params.isDirect ? params.invite?.[0] : undefined;
    if (other) {
      await this.recordDirectRoom(other, response.room_id);
    }

    return response.room_id;
  }

  public async invite(roomId: string, userIds: string[]): Promise<void> {
    const client = this.requireClient('invite members');
    await Promise.all(userIds.map((userId) => client.invite(roomId, userId)));
  }

  public async setRoomName(roomId: string, name: string): Promise<void> {
    const client = this.requireClient('rename a room');
    await client.setRoomName(roomId, name);
  }
}
