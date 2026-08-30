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
import { applyNotificationLevel, readNotificationLevel } from '../push/notificationLevel';
import { buildPusherRemoval, buildPusherRequest, parsePusher } from '../push/pusher';
import { missingHostRequirement } from './hostSupport';
import { decodeDataUri, isDataUri } from '../utils/dataUri';
import { PersistentSyncStore } from './PersistentSyncStore';
import { Emitter } from './Emitter';
import {
  AdapterMissingError,
  CryptoUnavailableError,
  HostRequirementError,
  MatrixRequestError,
  RoomNotFoundError,
  SessionNotReadyError,
} from './errors';
import type {
  CryptoOptions,
  LocalFile,
  MatrixAdapters,
  NotificationLevel,
  Pusher,
  PusherOptions,
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

  private syncStore: PersistentSyncStore | null = null;

  private stopped = false;

  /** What `registerPusher` last wrote, so rotation and removal know the key. */
  private pusher: { options: PusherOptions; pushkey: string } | null = null;

  private tokenRefreshUnsubscribe: Unsubscribe | null = null;

  public constructor(options: SessionOptions) {
    this.options = options;
    this.emitter = new Emitter<SessionEvents>((error) => this.reportError(error));
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Creates the underlying client, initialises crypto when requested and waits
   * for the first sync to complete.
   *
   * @throws HostRequirementError when the engine is missing a global the
   * library needs. Checked before anything else, so a missing polyfill is
   * named at startup instead of surfacing as a `TypeError` from inside the SDK
   * on the first request.
   * @throws CryptoUnavailableError when `crypto.enabled` is set but the
   * WebAssembly backend is missing. The session is left stopped in that case
   * rather than silently running without encryption.
   */
  public async start(): Promise<void> {
    if (this.client) {
      return;
    }

    const missingHost = missingHostRequirement();
    if (missingHost) {
      throw new HostRequirementError(missingHost);
    }

    const { credentials, initialSyncLimit, pollTimeoutMs, crypto, syncStorage } = this.options;

    // Built before the client, because the SDK reads the saved sync during
    // startClient() and a store handed over later would be ignored.
    this.syncStore = syncStorage
      ? new PersistentSyncStore({
          storage: syncStorage,
          ...(this.options.syncPersistence ?? {}),
          onError: (error) => this.reportError(error),
        })
      : null;

    this.client = createClient({
      baseUrl: credentials.baseUrl,
      accessToken: credentials.accessToken,
      userId: credentials.userId,
      deviceId: credentials.deviceId,
      // The access token travels in the Authorization header. 0.0.x appended
      // it to the query string of every request, where proxies log it.
      useAuthorizationHeader: true,
      ...(this.syncStore ? { store: this.syncStore } : {}),
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

  /**
   * Stops syncing and releases every listener. Safe to call more than once.
   *
   * When `syncStorage` is configured the final write is started here and not
   * awaited: `stop()` is called from effect cleanups, which cannot await, and
   * a failed write costs a full sync next launch rather than any data.
   * Await `flush()` first where the result matters.
   */
  public stop(): void {
    this.stopped = true;
    this.stopTokenRefresh();
    for (const detach of this.detachers) {
      detach();
    }
    this.detachers = [];
    this.client?.stopClient();
    void this.flush();
    this.emitter.removeAll();
    this.setStatus({ syncState: 'stopped', isReady: false });
  }

  /**
   * Writes the current sync state to `syncStorage` immediately.
   *
   * The store writes on its own schedule; call this when the application is
   * about to be backgrounded and the next launch should resume cheaply.
   * A no-op when no storage is configured.
   */
  public async flush(): Promise<void> {
    await this.syncStore?.save(true);
  }

  /**
   * Discards the persisted sync state.
   *
   * Call this on sign-out: the saved sync holds room state and message bodies
   * for the account that wrote it, and a different user signing in on the same
   * device must not resume from it.
   */
  public async clearPersistedSync(): Promise<void> {
    await this.syncStore?.deleteAllData();
  }

  // ------------------------------------------------------------------- push

  /**
   * Registers this device with the homeserver so it receives pushes.
   *
   * The token comes from the `pushToken` adapter unless `pushkey` is passed
   * explicitly. When the adapter reports a rotation the pusher is rewritten
   * automatically: without that, a rotation silently ends notifications and
   * nothing anywhere reports an error.
   *
   * @returns the pushkey registered, or null when the adapter has no token —
   * the normal state before the user grants permission, not a failure.
   */
  public async registerPusher(options: PusherOptions): Promise<string | null> {
    const client = this.requireClient('register a pusher');
    const adapter = this.adapters.pushToken;
    // No adapter at all is a configuration mistake, and the project's rule is
    // that a missing adapter is never a silent no-op — see
    // memory_bank/engineering/adapters.md#absence-behaviour. An adapter that
    // has no token *yet* is a different thing entirely, handled below.
    if (!options.pushkey && !adapter) {
      throw new AdapterMissingError('pushToken', 'Registering a pusher');
    }

    const pushkey = options.pushkey ?? (await adapter?.getToken()) ?? null;
    if (!pushkey) {
      // No token yet is the normal first launch: permission has not been
      // granted. Watch anyway — the token arrives through the refresh
      // callback the moment it is granted, and returning without watching
      // would mean this device never registers at all.
      this.watchTokenRefresh(options);
      return null;
    }

    const previous = this.pusher;
    await this.writePusher(client, options, pushkey);
    this.pusher = { options, pushkey };

    // `append: false` does not do this. The specification has it remove
    // pushers with the same app ID *and pushkey* belonging to other users; a
    // rotated token is a different pushkey, so the old one survives and the
    // homeserver keeps pushing to a key nothing reads. Removed after writing
    // the new one, so a failure in between leaves notifications working
    // rather than silenced.
    if (previous && previous.pushkey !== pushkey) {
      await this.removePusher(client, previous.options.appId, previous.pushkey);
    }

    this.watchTokenRefresh(options);
    return pushkey;
  }

  /**
   * Removes this device's pusher.
   *
   * **Sign-out must call this.** A pusher outlives the access token that
   * created it, so a device that signs out without removing it keeps waking
   * up for an account the user has left.
   *
   * With no argument this removes what `registerPusher` wrote in *this*
   * session. That is not enough on its own: a pusher registered on a previous
   * launch is unknown to a fresh session, so signing out after a restart —
   * the ordinary case — would remove nothing. Pass `appId` for that, and the
   * pushkey is taken from the `pushToken` adapter unless given.
   *
   * @returns the pushkey removed, or null when there was nothing to remove.
   */
  public async unregisterPusher(options?: {
    appId: string;
    pushkey?: string;
  }): Promise<string | null> {
    const client = this.requireClient('remove a pusher');
    this.stopTokenRefresh();

    const registered = this.pusher;
    const appId = options?.appId ?? registered?.options.appId ?? null;
    const pushkey =
      options?.pushkey ??
      registered?.pushkey ??
      (await this.adapters.pushToken?.getToken()) ??
      null;

    if (!appId || !pushkey) {
      return null;
    }

    // Cleared after the call, not before: a failed removal that had already
    // forgotten the pusher leaves the device receiving pushes for a signed-out
    // account with no way to retry, because the retry sees nothing to remove.
    await this.removePusher(client, appId, pushkey);
    this.pusher = null;
    return pushkey;
  }

  private async removePusher(
    client: MatrixClient,
    appId: string,
    pushkey: string,
  ): Promise<void> {
    try {
      await client.setPusher(buildPusherRemoval(appId, pushkey) as never);
    } catch (error) {
      throw MatrixRequestError.from(error);
    }
  }

  /** Every pusher on the account, across devices. */
  public async getPushers(): Promise<Pusher[]> {
    const client = this.requireClient('list pushers');
    try {
      const response = await client.getPushers();
      return (response.pushers ?? []).map(parsePusher);
    } catch (error) {
      throw MatrixRequestError.from(error);
    }
  }

  /** What this room notifies for, derived from the account's push rules. */
  public async getNotificationLevel(roomId: string): Promise<NotificationLevel> {
    const client = this.requireClient('read notification settings');
    try {
      return readNotificationLevel(await client.getPushRules(), roomId);
    } catch (error) {
      throw MatrixRequestError.from(error);
    }
  }

  /** Sets what this room notifies for, clearing whatever the last level left. */
  public async setNotificationLevel(roomId: string, level: NotificationLevel): Promise<void> {
    const client = this.requireClient('change notification settings');
    try {
      await applyNotificationLevel(client, roomId, level);
    } catch (error) {
      throw MatrixRequestError.from(error);
    }
  }

  private async writePusher(
    client: MatrixClient,
    options: PusherOptions,
    pushkey: string,
  ): Promise<void> {
    try {
      await client.setPusher(buildPusherRequest(options, pushkey) as never);
    } catch (error) {
      throw MatrixRequestError.from(error);
    }
  }

  private watchTokenRefresh(options: PusherOptions): void {
    this.stopTokenRefresh();
    const adapter = this.adapters.pushToken;
    if (!adapter?.onTokenRefresh) {
      return;
    }
    this.tokenRefreshUnsubscribe = adapter.onTokenRefresh((token: string) => {
      if (this.stopped || !this.client || this.pusher?.pushkey === token) {
        return;
      }
      // Fire and forget: this runs inside the messaging library's callback,
      // where a rejection has nowhere to go but the session's error reporter.
      // Routed through registerPusher so the old pushkey is removed, which is
      // the whole point of reacting to a rotation.
      void this.registerPusher({ ...options, pushkey: token }).catch((error: unknown) =>
        this.reportError(error as Error),
      );
    });
  }

  private stopTokenRefresh(): void {
    this.tokenRefreshUnsubscribe?.();
    this.tokenRefreshUnsubscribe = null;
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
  /**
   * Reads a local file into something uploadable.
   *
   * `data:` URIs are decoded here rather than fetched. React Native's `fetch`
   * reads them on iOS and rejects them on Android with "Network request
   * failed" before any request leaves the device, so an adapter returning
   * in-memory bytes — a signature pad, a cropped canvas — worked on one
   * platform only.
   */
  private async readLocalFile(file: LocalFile): Promise<{ body: unknown; byteLength: number }> {
    if (isDataUri(file.uri)) {
      try {
        const { bytes } = decodeDataUri(file.uri);
        return { body: bytes, byteLength: bytes.byteLength };
      } catch (error) {
        throw new MatrixRequestError(
          `Could not decode the data URI passed as ${file.name}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
          null,
          null,
        );
      }
    }

    const response = await fetch(file.uri);
    if (!response.ok) {
      throw new MatrixRequestError(
        `Could not read ${file.uri} (HTTP ${response.status})`,
        response.status,
        null,
      );
    }
    const blob = await response.blob();
    return { body: blob, byteLength: blob.size };
  }

  public async sendFile(
    roomId: string,
    file: LocalFile,
    options: { replyToEventId?: string; threadRootId?: string } = {},
  ): Promise<string> {
    const client = this.requireClient('send a file');

    const { body, byteLength } = await this.readLocalFile(file);

    const upload = await client.uploadContent(body as never, {
      name: file.name,
      type: file.mimeType,
    });

    const info: Record<string, unknown> = { mimetype: file.mimeType, size: file.size ?? byteLength };
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
