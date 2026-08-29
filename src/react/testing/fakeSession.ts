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

import type { MatrixEvent, Room } from 'matrix-js-sdk';

import { Emitter } from '../../core/Emitter';
import type { MatrixSession, SessionEvents } from '../../core/MatrixSession';
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
  name?: string;
  membership?: string;
  unreadCount?: number;
  highlightCount?: number;
  members?: FakeMember[];
  myUserId?: string;
}

export class FakeRoom {
  public readonly roomId = '!room:localhost';

  public readonly myUserId: string;

  public readonly name: string;

  private events: MatrixEvent[] = [];

  private reactions: MatrixEvent[] = [];

  private readonly init: FakeRoomInit;

  public constructor(events: MatrixEvent[] = [], init: FakeRoomInit = {}) {
    this.events = events;
    this.init = init;
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
    return this.events[this.events.length - 1]?.getTs() ?? 0;
  }

  /** Room state is empty unless a test needs an avatar or encryption flag. */
  public get currentState() {
    return { getStateEvents: () => undefined };
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
  room: FakeRoom;
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
}

export interface FakeSessionInit extends FakeRoomInit {
  userId?: string;
  events?: MatrixEvent[];
  /** Adapters the fake host supplies. Empty by default, as in a bare install. */
  adapters?: MatrixAdapters;
}

export function createFakeSession(options: FakeSessionInit = {}): FakeSession {
  const userId = options.userId ?? '@alice:localhost';
  const room = new FakeRoom(options.events ?? [], { myUserId: userId, ...options });
  const emitter = new Emitter<SessionEvents>();

  // Enough of the SDK client for media resolution and direct-room detection.
  const client = {
    mxcUrlToHttp: (mxcUri: string) => `https://homeserver.test/media/${mxcUri.slice('mxc://'.length)}`,
    getAccessToken: () => 'fake-token',
    getAccountData: () => undefined,
  };

  const status: SessionStatus = {
    syncState: 'syncing',
    isReady: true,
    totalUnread: 0,
    error: null,
    isCryptoEnabled: false,
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
  };

  const session = {
    userId,
    adapters: options.adapters ?? {},
    getStatus: () => status,
    getClient: () => client,
    getRoom: () => room.asRoom(),
    getRooms: () => [room.asRoom()],
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
    invite: async () => undefined,
    setRoomName: async () => undefined,
  } as unknown as MatrixSession;

  return {
    session,
    room,
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
  };
}
