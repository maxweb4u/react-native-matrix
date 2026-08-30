import { EventType, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';

import { MessageKind } from '../../types/content';
import type { RoomSummary } from '../../types/timeline';
import { buildRoomSummary, directRoomUserIds, sortRoomSummaries } from '../roomSummary';

/**
 * Fakes, not mocks of the SDK: `buildRoomSummary` reads a handful of `Room`
 * methods and nothing else, so a literal shaped like one is both enough and
 * far more legible than a partial mock of the real class.
 */

interface FakeEventOptions {
  id?: string;
  type?: string;
  sender?: string;
  content?: Record<string, unknown>;
  ts?: number;
  redacted?: boolean;
}

function fakeEvent(options: FakeEventOptions = {}): MatrixEvent {
  const content = options.content ?? { msgtype: 'm.text', body: 'hello' };
  return {
    getId: () => options.id ?? '$event',
    getType: () => options.type ?? EventType.RoomMessage,
    getSender: () => options.sender ?? '@alice:example.org',
    getContent: () => content,
    getTs: () => options.ts ?? 1000,
    isRedacted: () => options.redacted ?? false,
  } as unknown as MatrixEvent;
}

interface FakeRoomOptions {
  roomId?: string;
  name?: string;
  events?: MatrixEvent[];
  membership?: string;
  myUserId?: string;
  unread?: number;
  highlight?: number;
  memberCount?: number;
  lastActive?: number;
  encrypted?: boolean;
  avatarUrl?: string | null;
  members?: Record<string, { name: string; avatar?: string | null }>;
}

function fakeRoom(options: FakeRoomOptions = {}): Room {
  const stateEvents: Record<string, unknown> = {};
  if (options.encrypted) {
    stateEvents[EventType.RoomEncryption] = { getContent: () => ({}) };
  }
  if (options.avatarUrl !== undefined && options.avatarUrl !== null) {
    stateEvents[EventType.RoomAvatar] = { getContent: () => ({ url: options.avatarUrl }) };
  }

  return {
    roomId: options.roomId ?? '!room:example.org',
    name: options.name ?? 'Room',
    myUserId: options.myUserId ?? '@me:example.org',
    getLiveTimeline: () => ({ getEvents: () => options.events ?? [] }),
    getMyMembership: () => options.membership ?? 'join',
    getUnreadNotificationCount: (kind?: string) =>
      kind === 'highlight' ? options.highlight : options.unread,
    getJoinedMemberCount: () => options.memberCount ?? 2,
    getLastActiveTimestamp: () => options.lastActive ?? 0,
    getMember: (userId: string) => {
      const member = options.members?.[userId];
      return member
        ? { name: member.name, getMxcAvatarUrl: () => member.avatar ?? null }
        : null;
    },
    currentState: {
      getStateEvents: (type: string) => stateEvents[type] ?? null,
    },
  } as unknown as Room;
}

function fakeClient(directContent: Record<string, unknown> | null = null): MatrixClient {
  return {
    getAccountData: (type: string) =>
      type === EventType.Direct && directContent
        ? { getContent: () => directContent }
        : undefined,
  } as unknown as MatrixClient;
}

const summary = (overrides: Partial<RoomSummary>): RoomSummary =>
  ({
    id: '!room:example.org',
    name: 'Room',
    avatarMxcUri: null,
    isDirect: false,
    directUserId: null,
    membership: 'join',
    isEncrypted: false,
    unreadCount: 0,
    highlightCount: 0,
    lastActivityTs: 0,
    lastMessage: null,
    memberCount: 2,
    ...overrides,
  }) as RoomSummary;

describe('sortRoomSummaries', () => {
  it('orders by newest activity first', () => {
    const sorted = sortRoomSummaries([
      summary({ id: 'old', lastActivityTs: 1000 }),
      summary({ id: 'new', lastActivityTs: 3000 }),
      summary({ id: 'mid', lastActivityTs: 2000 }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['new', 'mid', 'old']);
  });

  it('pins invites above joined rooms regardless of activity', () => {
    const sorted = sortRoomSummaries([
      summary({ id: 'busy', lastActivityTs: 9000 }),
      summary({ id: 'invite', membership: 'invite', lastActivityTs: 1 }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['invite', 'busy']);
  });

  it('orders several invites among themselves by activity', () => {
    const sorted = sortRoomSummaries([
      summary({ id: 'older-invite', membership: 'invite', lastActivityTs: 1000 }),
      summary({ id: 'joined', lastActivityTs: 5000 }),
      summary({ id: 'newer-invite', membership: 'invite', lastActivityTs: 2000 }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['newer-invite', 'older-invite', 'joined']);
  });

  it('returns a signed number from the comparator, not a boolean', () => {
    // The audit defect this file exists for. 0.0.x returned `a.ts < b.ts`,
    // which coerces to 0 or 1 and never to a negative, so `sort` was fed an
    // inconsistent comparator and the order came out arbitrary. Ten entries in
    // reverse is enough that a boolean comparator cannot produce this result.
    const input = Array.from({ length: 10 }, (_, index) =>
      summary({ id: `r${index}`, lastActivityTs: index * 1000 }),
    );

    const sorted = sortRoomSummaries(input);

    expect(sorted.map((entry) => entry.lastActivityTs)).toEqual([
      9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 0,
    ]);
  });

  it('does not mutate the array it was given', () => {
    const input = [
      summary({ id: 'a', lastActivityTs: 1000 }),
      summary({ id: 'b', lastActivityTs: 2000 }),
    ];

    sortRoomSummaries(input);

    expect(input.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('directRoomUserIds', () => {
  it('maps every room in m.direct to its other participant', () => {
    const mapping = directRoomUserIds(
      fakeClient({ '@bob:example.org': ['!one:example.org', '!two:example.org'] }),
    );

    expect(mapping.get('!one:example.org')).toBe('@bob:example.org');
    expect(mapping.get('!two:example.org')).toBe('@bob:example.org');
  });

  it('is empty when the account has no m.direct at all', () => {
    expect(directRoomUserIds(fakeClient(null)).size).toBe(0);
  });

  it('keeps the first user when a room is listed under two of them', () => {
    const mapping = directRoomUserIds({
      getAccountData: () => ({
        getContent: () => ({
          '@first:example.org': ['!shared:example.org'],
          '@second:example.org': ['!shared:example.org'],
        }),
      }),
    } as unknown as MatrixClient);

    expect(mapping.get('!shared:example.org')).toBe('@first:example.org');
  });

  it('skips entries whose value is not an array of room IDs', () => {
    const mapping = directRoomUserIds(
      fakeClient({ '@bob:example.org': 'not-an-array', '@carol:example.org': ['!ok:example.org'] }),
    );

    expect(mapping.size).toBe(1);
    expect(mapping.get('!ok:example.org')).toBe('@carol:example.org');
  });
});

describe('buildRoomSummary', () => {
  it('previews the newest renderable message', () => {
    const room = fakeRoom({
      events: [
        fakeEvent({ id: '$old', ts: 1000, content: { msgtype: 'm.text', body: 'first' } }),
        fakeEvent({ id: '$new', ts: 2000, content: { msgtype: 'm.text', body: 'second' } }),
      ],
      members: { '@alice:example.org': { name: 'Alice' } },
    });

    const built = buildRoomSummary(room, { client: fakeClient() });

    expect(built.lastMessage?.eventId).toBe('$new');
    expect(built.lastMessage?.body).toBe('second');
    expect(built.lastMessage?.senderDisplayName).toBe('Alice');
    expect(built.lastActivityTs).toBe(2000);
  });

  it('skips back past events that render nothing', () => {
    const room = fakeRoom({
      events: [
        fakeEvent({ id: '$message', ts: 1000 }),
        fakeEvent({ id: '$membership', ts: 2000, type: EventType.RoomMember }),
      ],
    });

    expect(buildRoomSummary(room, { client: fakeClient() }).lastMessage?.eventId).toBe('$message');
  });

  it('shows a redacted newest message as a tombstone with no body', () => {
    const room = fakeRoom({ events: [fakeEvent({ id: '$gone', redacted: true })] });

    const built = buildRoomSummary(room, { client: fakeClient() });

    expect(built.lastMessage?.kind).toBe(MessageKind.Redacted);
    expect(built.lastMessage?.body).toBe('');
  });

  it('falls back to the room timestamp when nothing is renderable', () => {
    const room = fakeRoom({ events: [], lastActive: 4242 });

    const built = buildRoomSummary(room, { client: fakeClient() });

    expect(built.lastMessage).toBeNull();
    expect(built.lastActivityTs).toBe(4242);
  });

  it('takes a direct room avatar from the other member, not room state', () => {
    const room = fakeRoom({
      roomId: '!dm:example.org',
      avatarUrl: 'mxc://example.org/room',
      members: { '@bob:example.org': { name: 'Bob', avatar: 'mxc://example.org/bob' } },
    });

    const built = buildRoomSummary(room, {
      client: fakeClient({ '@bob:example.org': ['!dm:example.org'] }),
    });

    expect(built.isDirect).toBe(true);
    expect(built.directUserId).toBe('@bob:example.org');
    expect(built.avatarMxcUri).toBe('mxc://example.org/bob');
  });

  it('takes a group room avatar from room state', () => {
    const room = fakeRoom({ avatarUrl: 'mxc://example.org/room' });

    const built = buildRoomSummary(room, { client: fakeClient() });

    expect(built.isDirect).toBe(false);
    expect(built.avatarMxcUri).toBe('mxc://example.org/room');
  });

  it('reads account data once when a precomputed direct map is passed', () => {
    const getAccountData = jest.fn();
    const client = { getAccountData } as unknown as MatrixClient;

    buildRoomSummary(fakeRoom(), { client, directRooms: new Map() });

    expect(getAccountData).not.toHaveBeenCalled();
  });

  it('reports undefined unread counts as zero', () => {
    // The SDK returns undefined before the first sync. Passing that through
    // would render "undefined" in the badge.
    const built = buildRoomSummary(fakeRoom({}), { client: fakeClient() });

    expect(built.unreadCount).toBe(0);
    expect(built.highlightCount).toBe(0);
  });

  it('carries unread, highlight, encryption and membership through', () => {
    const room = fakeRoom({
      membership: 'invite',
      unread: 3,
      highlight: 1,
      encrypted: true,
      memberCount: 7,
    });

    const built = buildRoomSummary(room, { client: fakeClient() });

    expect(built.membership).toBe('invite');
    expect(built.unreadCount).toBe(3);
    expect(built.highlightCount).toBe(1);
    expect(built.isEncrypted).toBe(true);
    expect(built.memberCount).toBe(7);
  });

  it('marks the sender as self when it is the logged-in user', () => {
    const room = fakeRoom({
      myUserId: '@me:example.org',
      events: [fakeEvent({ sender: '@me:example.org' })],
    });

    expect(buildRoomSummary(room, { client: fakeClient() }).lastMessage?.isOwn).toBe(true);
  });
});
