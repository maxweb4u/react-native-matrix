/**
 * Test doubles for the React layer.
 *
 * These stand in for `MatrixSession` and the SDK objects it exposes. They are
 * deliberately hand-written rather than generated from mocks: the hooks depend
 * on a small, stable slice of the SDK, and spelling that slice out here makes
 * the coupling visible.
 *
 * Excluded from the published build by tsconfig.build.json.
 */

import { EventType, type MatrixEvent, type Room } from 'matrix-js-sdk';

import { Emitter } from '../../core/Emitter';
import { RoomNotFoundError } from '../../core/errors';
import type { MatrixSession, SessionEvents } from '../../core/MatrixSession';
import { NotificationLevel } from '../../types/push';
import type { LocalFile, MatrixAdapters, SessionStatus } from '../../types';

export interface FakeEventInit {
  id: string;
  sender: string;
  ts: number;
  type?: string;
  content?: Record<string, unknown>;
  txnId?: string;
  redacted?: boolean;
  status?: string | null;
  associatedId?: string;
}

export function fakeEvent(init: FakeEventInit): MatrixEvent {
  const content = init.content ?? { msgtype: 'm.text', body: `body-${init.id}` };
  let currentId = init.id;
  let replacing: MatrixEvent | null = null;
  let redacted = init.redacted === true;

  const event = {
    getId: () => currentId,
    getTxnId: () => init.txnId,
    getRoomId: () => '!room:localhost',
    getSender: () => init.sender,
    getTs: () => init.ts,
    getType: () => init.type ?? 'm.room.message',
    getContent: () => content,
    getUnsigned: () => ({}),
    getAssociatedId: () => init.associatedId,
    isRedacted: () => redacted,
    isDecryptionFailure: () => false,
    isEncrypted: () => false,
    replacingEvent: () => replacing,
    status: init.status ?? null,
    /** Test helper: mimics the SDK swapping a local echo's ID on confirmation. */
    __confirm: (remoteId: string) => {
      currentId = remoteId;
    },
    __setReplacing: (replacement: MatrixEvent | null) => {
      replacing = replacement;
    },
    /** Test helper: a redacted event keeps its identity but loses its content. */
    __redact: () => {
      redacted = true;
    },
  };

  return event as unknown as MatrixEvent;
}

export interface FakeMember {
  userId: string;
  displayName?: string;
  avatarMxcUri?: string | null;
  membership?: string;
  powerLevel?: number;
}

export interface FakeRoomInit {
  roomId?: string;
  name?: string;
  membership?: string;
  unreadCount?: number;
  highlightCount?: number;
  members?: FakeMember[];
  myUserId?: string;
  /** Renders as an `m.room.encryption` state event. */
  encrypted?: boolean;
  /** Renders as an `m.room.avatar` state event. */
  avatarMxcUri?: string;
  /** Event each user has read up to, as `m.receipt` leaves it. */
  receipts?: Record<string, string>;
  /** Used when the room has no renderable event to date it by. */
  lastActivityTs?: number;
}

export class FakeRoom {
  public readonly roomId: string;

  public readonly myUserId: string;

  public readonly name: string;

  private events: MatrixEvent[] = [];

  private reactions: MatrixEvent[] = [];

  private readonly init: FakeRoomInit;

  public constructor(events: MatrixEvent[] = [], init: FakeRoomInit = {}) {
    this.events = events;
    this.init = init;
    this.roomId = init.roomId ?? '!room:localhost';
    this.name = init.name ?? 'Test room';
    this.myUserId = init.myUserId ?? '@alice:localhost';
  }

  public getMyMembership(): string {
    return this.init.membership ?? 'join';
  }

  public getUnreadNotificationCount(type?: string): number {
    return type === 'highlight' ? (this.init.highlightCount ?? 0) : (this.init.unreadCount ?? 0);
  }

  public getJoinedMemberCount(): number {
    return this.init.members?.length ?? 1;
  }

  public getLastActiveTimestamp(): number {
    return this.events[this.events.length - 1]?.getTs() ?? this.init.lastActivityTs ?? 0;
  }

  /** Only the two state events the summary builder reads. */
  public get currentState() {
    const init = this.init;
    return {
      getStateEvents: (type: string, _stateKey?: string) => {
        if (type === EventType.RoomEncryption) {
          // The builder only tests this for truthiness.
          return init.encrypted ? ({} as never) : undefined;
        }
        if (type === EventType.RoomAvatar && init.avatarMxcUri) {
          return { getContent: () => ({ url: init.avatarMxcUri }) } as never;
        }
        return undefined;
      },
    };
  }

  public getEventReadUpTo(userId: string): string | null {
    return this.init.receipts?.[userId] ?? null;
  }

  /**
   * The SDK returns the users whose receipt names *this* event, not everyone
   * whose receipt is at or past it. Reproduced exactly, because `readersOf`
   * delegates to it and a looser fake would hide that distinction.
   */
  public getUsersReadUpTo(event: MatrixEvent): string[] {
    const eventId = event.getId();
    return Object.entries(this.init.receipts ?? {})
      .filter(([, readUpTo]) => readUpTo === eventId)
      .map(([userId]) => userId);
  }

  /** Test helper: a room can become encrypted while a screen is open. */
  public __setEncrypted(encrypted: boolean): void {
    this.init.encrypted = encrypted;
  }

  /** Test helper: moves a user's receipt, as an incoming `m.receipt` would. */
  public __setReceipt(userId: string, eventId: string): void {
    this.init.receipts = { ...this.init.receipts, [userId]: eventId };
  }

  public addEvent(event: MatrixEvent): void {
    this.events.push(event);
  }

  public addReaction(event: MatrixEvent): void {
    this.reactions.push(event);
  }

  public prependEvents(events: MatrixEvent[]): void {
    this.events = [...events, ...this.events];
  }

  public getLiveTimeline() {
    return { getEvents: () => this.events };
  }

  public findEventById(id: string): MatrixEvent | undefined {
    return [...this.events, ...this.reactions].find((event) => event.getId() === id);
  }

  public getMember(userId: string) {
    const member = this.init.members?.find((candidate) => candidate.userId === userId);
    return {
      userId,
      name: member?.displayName ?? userId.slice(1).split(':')[0],
      getMxcAvatarUrl: () => member?.avatarMxcUri ?? undefined,
      membership: member?.membership ?? 'join',
      powerLevel: member?.powerLevel ?? 0,
    };
  }

  public getMembers() {
    return (this.init.members ?? []).map((member) => this.getMember(member.userId));
  }

  public getUnfilteredTimelineSet() {
    return {
      relations: {
        getChildEventsForEvent: (eventId: string) => ({
          getRelations: () =>
            this.reactions.filter((reaction) => {
              const relatesTo = reaction.getContent()['m.relates_to'] as
                | { event_id?: string }
                | undefined;
              return relatesTo?.event_id === eventId;
            }),
        }),
      },
    };
  }

  public asRoom(): Room {
    return this as unknown as Room;
  }
}

export interface FakeSession {
  session: MatrixSession;
  /** The room every fake session has. `rooms[0]` is the same object. */
  room: FakeRoom;
  rooms: FakeRoom[];
  emitter: Emitter<SessionEvents>;
  /** Delivers a live timeline event exactly as MatrixSession would. */
  emitTimeline: (event: MatrixEvent) => void;
  /** `previousEventId` mirrors the ID the SDK reports when an echo confirms. */
  emitLocalEcho: (event: MatrixEvent, previousEventId?: string | null) => void;
  paginateCalls: number;
  /** Bodies passed to `sendText`, in order. */
  sent: string[];
  files: LocalFile[];
  edits: { eventId: string; body: string }[];
  reactions: { eventId: string; key: string }[];
  /** Every `sendTyping` argument, so throttling can be asserted. */
  typing: boolean[];
  joined: string[];
  left: string[];
  invites: { roomId: string; userIds: string[] }[];
  renames: { roomId: string; name: string }[];
  /** Every accepted `setNotificationLevel`, in order. */
  notificationWrites: { roomId: string; level: NotificationLevel }[];
  /** Seeds a level without going through the hook. */
  setNotificationLevelFor: (roomId: string, level: NotificationLevel) => void;
  /** Holds the next writes open, so an optimistic update can be observed. */
  holdNotificationWrite: () => void;
  releaseNotificationWrite: () => void;
  /** Holds the initial read open, as a real round trip does. */
  holdNotificationRead: () => void;
  releaseNotificationRead: () => void;
  /** Makes writes reject; pass null to stop failing. */
  failNotificationWrite: (error: Error | null) => void;
  failNotificationRead: (error: Error | null) => void;
  /** State events written through the client, for the encryption path. */
  stateEvents: { roomId: string; type: string; content: Record<string, unknown>; stateKey: string }[];
  /** Announces a room change, exactly as MatrixSession does after a sync. */
  emitRoomSummary: (roomId?: string) => void;
  emitReceipt: (roomId?: string) => void;
  emitTyping: (userIds: string[], roomId?: string) => void;
  /**
   * Replaces the status object and emits, as the session's own patch does.
   * Replacing rather than mutating is what makes `useSyncExternalStore` see
   * the change; a fake that mutated in place would pass while the hook was
   * broken.
   */
  setStatus: (patch: Partial<SessionStatus>) => void;
}

export interface FakeRoomsInit extends FakeRoomInit {
  events?: MatrixEvent[];
}

export interface FakeSessionInit extends FakeRoomInit {
  userId?: string;
  events?: MatrixEvent[];
  /** Adapters the fake host supplies. Empty by default, as in a bare install. */
  adapters?: MatrixAdapters;
  /** Rooms beyond the default one, for the list hooks. */
  rooms?: FakeRoomsInit[];
  /** `m.direct` account data: user ID to the rooms shared with them. */
  directRooms?: Record<string, string[]>;
  isCryptoEnabled?: boolean;
  /** Level reported for the default room. Others default to `all`. */
  notificationLevel?: NotificationLevel;
}

export function createFakeSession(options: FakeSessionInit = {}): FakeSession {
  const userId = options.userId ?? '@alice:localhost';
  const room = new FakeRoom(options.events ?? [], { myUserId: userId, ...options });
  const rooms = [
    room,
    ...(options.rooms ?? []).map(
      (init) => new FakeRoom(init.events ?? [], { myUserId: userId, ...init }),
    ),
  ];
  const emitter = new Emitter<SessionEvents>();

  // Enough of the SDK client for media resolution and direct-room detection.
  const client = {
    mxcUrlToHttp: (mxcUri: string) => `https://homeserver.test/media/${mxcUri.slice('mxc://'.length)}`,
    getAccessToken: () => 'fake-token',
    getAccountData: (type: string) =>
      type === EventType.Direct && options.directRooms
        ? ({ getContent: () => options.directRooms } as never)
        : undefined,
    sendStateEvent: async (
      roomId: string,
      type: string,
      content: Record<string, unknown>,
      stateKey: string,
    ) => {
      state.stateEvents.push({ roomId, type, content, stateKey });
      return { event_id: `$state-${state.stateEvents.length}` };
    },
  };

  let status: SessionStatus = {
    syncState: 'syncing',
    isReady: true,
    totalUnread: 0,
    error: null,
    isCryptoEnabled: options.isCryptoEnabled ?? false,
  };

  const levels = new Map<string, NotificationLevel>([
    [room.roomId, options.notificationLevel ?? NotificationLevel.All],
  ]);
  let readError: Error | null = null;
  let writeError: Error | null = null;
  let held: (() => void) | null = null;
  let heldRead: (() => void) | null = null;

  const findRoom = (roomId: string): FakeRoom => {
    const found = rooms.find((candidate) => candidate.roomId === roomId);
    if (!found) {
      throw new RoomNotFoundError(roomId);
    }
    return found;
  };

  const state = {
    paginateCalls: 0,
    sent: [] as string[],
    files: [] as LocalFile[],
    edits: [] as { eventId: string; body: string }[],
    reactions: [] as { eventId: string; key: string }[],
    typing: [] as boolean[],
    joined: [] as string[],
    left: [] as string[],
    invites: [] as { roomId: string; userIds: string[] }[],
    renames: [] as { roomId: string; name: string }[],
    notificationWrites: [] as { roomId: string; level: NotificationLevel }[],
    stateEvents: [] as {
      roomId: string;
      type: string;
      content: Record<string, unknown>;
      stateKey: string;
    }[],
  };

  const session = {
    userId,
    adapters: options.adapters ?? {},
    getStatus: () => status,
    getClient: () => client,
    getRoom: (roomId: string) => findRoom(roomId).asRoom(),
    getRooms: () => rooms.map((candidate) => candidate.asRoom()),
    isRoomEncrypted: (roomId: string) => {
      try {
        return Boolean(findRoom(roomId).currentState.getStateEvents(EventType.RoomEncryption, ''));
      } catch {
        return false;
      }
    },
    isOwnUser: (candidate: string) => candidate === userId,
    on: <K extends keyof SessionEvents>(
      event: K,
      listener: (payload: SessionEvents[K]) => void,
    ) => emitter.on(event, listener),
    paginateBack: async () => {
      state.paginateCalls += 1;
      // Two pages of history, then the start of the room.
      return state.paginateCalls < 2;
    },
    sendText: async (_roomId: string, body: string) => {
      state.sent.push(body);
      return `$sent-${state.sent.length}`;
    },
    sendFile: async (_roomId: string, file: LocalFile) => {
      state.files.push(file);
      return `$file-${state.files.length}`;
    },
    react: async (_roomId: string, eventId: string, key: string) => {
      state.reactions.push({ eventId, key });
      return '$reaction';
    },
    unreact: async () => undefined,
    redact: async () => undefined,
    editText: async (_roomId: string, eventId: string, body: string) => {
      state.edits.push({ eventId, body });
      return '$edit';
    },
    markRead: async () => undefined,
    retrySend: async () => undefined,
    sendTyping: async (_roomId: string, isTyping: boolean) => {
      state.typing.push(isTyping);
    },
    joinRoom: async (roomId: string) => {
      state.joined.push(roomId);
    },
    leaveRoom: async (roomId: string) => {
      state.left.push(roomId);
    },
    getNotificationLevel: async (roomId: string) => {
      // Answered from the value at call time, not at resolution time. A real
      // homeserver replies with what it knew when the request arrived, which
      // is what makes a write racing a read able to be overwritten at all.
      const answer = levels.get(roomId) ?? NotificationLevel.All;
      if (heldRead) {
        await new Promise<void>((resolve) => {
          heldRead = resolve;
        });
      }
      if (readError) {
        throw readError;
      }
      return answer;
    },
    setNotificationLevel: async (roomId: string, level: NotificationLevel) => {
      if (held) {
        await new Promise<void>((resolve) => {
          held = resolve;
        });
      }
      if (writeError) {
        throw writeError;
      }
      levels.set(roomId, level);
      state.notificationWrites.push({ roomId, level });
    },
    invite: async (roomId: string, userIds: string[]) => {
      state.invites.push({ roomId, userIds });
    },
    setRoomName: async (roomId: string, name: string) => {
      state.renames.push({ roomId, name });
    },
  } as unknown as MatrixSession;

  return {
    session,
    room,
    rooms,
    emitter,
    emitTimeline: (event: MatrixEvent) =>
      emitter.emit('timeline', { roomId: room.roomId, event, isLive: true }),
    emitLocalEcho: (event: MatrixEvent, previousEventId: string | null = null) =>
      emitter.emit('localEcho', { roomId: room.roomId, event, previousEventId }),
    get paginateCalls() {
      return state.paginateCalls;
    },
    get sent() {
      return state.sent;
    },
    get files() {
      return state.files;
    },
    get edits() {
      return state.edits;
    },
    get reactions() {
      return state.reactions;
    },
    get typing() {
      return state.typing;
    },
    get joined() {
      return state.joined;
    },
    get left() {
      return state.left;
    },
    get invites() {
      return state.invites;
    },
    get renames() {
      return state.renames;
    },
    get stateEvents() {
      return state.stateEvents;
    },
    get notificationWrites() {
      return state.notificationWrites;
    },
    setNotificationLevelFor: (roomId: string, level: NotificationLevel) => {
      levels.set(roomId, level);
    },
    holdNotificationWrite: () => {
      held = () => undefined;
    },
    holdNotificationRead: () => {
      heldRead = () => undefined;
    },
    releaseNotificationRead: () => {
      const resume = heldRead;
      heldRead = null;
      resume?.();
    },
    releaseNotificationWrite: () => {
      const resume = held;
      held = null;
      resume?.();
    },
    failNotificationWrite: (error: Error | null) => {
      writeError = error;
    },
    failNotificationRead: (error: Error | null) => {
      readError = error;
    },
    emitRoomSummary: (roomId: string = room.roomId) => emitter.emit('roomSummary', { roomId }),
    emitReceipt: (roomId: string = room.roomId) => emitter.emit('receipt', { roomId }),
    emitTyping: (userIds: string[], roomId: string = room.roomId) =>
      emitter.emit('typing', { roomId, userIds }),
    setStatus: (patch: Partial<SessionStatus>) => {
      status = { ...status, ...patch };
      emitter.emit('status', status);
    },
  };
}
