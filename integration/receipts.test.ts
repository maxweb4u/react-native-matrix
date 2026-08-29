/**
 * Read receipts, typing notifications, and unread counts.
 *
 * All three are ephemeral or per-user server state, so none of them can be
 * exercised without a homeserver.
 */

import type { MatrixSession } from '../src/core/MatrixSession';
import type { RoomTimeline } from '../src/timeline/RoomTimeline';
import { buildRoomSummary } from '../src/timeline/roomSummary';
import { ALICE, BOB, requireHomeserver } from './support/homeserver';
import {
  createSharedRoom,
  openTimeline,
  startSession,
  stopEverything,
  waitFor,
  waitForItem,
  waitForSessionEvent,
} from './support/harness';

let alice: MatrixSession;
let bob: MatrixSession;
let roomId: string;
let bobTimeline: RoomTimeline;

beforeAll(async () => {
  await requireHomeserver();
  [alice, bob] = await Promise.all([startSession(ALICE), startSession(BOB)]);
  roomId = await createSharedRoom(alice, bob, { name: 'Receipts' });
  bobTimeline = openTimeline(bob, roomId);
});

afterAll(() => {
  stopEverything();
});

describe('read receipts', () => {
  it('tells the sender the message was read', async () => {
    const eventId = await alice.sendText(roomId, 'read me');
    await waitForItem(bobTimeline, 'bob to receive the message', (item) => item.id === eventId);

    // Subscribe before acting: a warm homeserver can deliver the receipt
    // before the listener would otherwise be attached.
    const receipt = waitForSessionEvent(alice, 'receipt', (payload) => payload.roomId === roomId);
    await bob.markRead(roomId, eventId);
    await receipt;

    // 0.0.x declared `messageSent` twice in the same object literal. The second
    // definition silently replaced the first, so read markers were never sent
    // for messages the user had seen.
    await waitFor(
      `alice to see ${BOB.userId} read up to the message`,
      () => alice.getRoom(roomId).getEventReadUpTo(BOB.userId) === eventId,
    );
  });

  it('clears the unread count for the reader', async () => {
    const eventId = await alice.sendText(roomId, 'unread me');

    await waitFor('the message to raise bob’s unread count', () => {
      const room = bob.getClient().getRoom(roomId);
      return room ? buildRoomSummary(room, { client: bob.getClient() }).unreadCount > 0 : null;
    });

    await bob.markRead(roomId, eventId);

    await waitFor('bob’s unread count to fall back to zero', () => {
      const room = bob.getClient().getRoom(roomId);
      return room ? buildRoomSummary(room, { client: bob.getClient() }).unreadCount === 0 : null;
    });
  });
});

describe('typing notifications', () => {
  it('reports who is typing and when they stop', async () => {
    const started = waitForSessionEvent(
      alice,
      'typing',
      (payload) => payload.roomId === roomId && payload.userIds.includes(BOB.userId),
    );
    await bob.sendTyping(roomId, true, 10_000);
    const payload = await started;

    // The local user is never listed: a client renders "Bob is typing", never
    // its own indicator.
    expect(payload.userIds).toEqual([BOB.userId]);

    const stopped = waitForSessionEvent(
      alice,
      'typing',
      (event) => event.roomId === roomId && event.userIds.length === 0,
    );
    await bob.sendTyping(roomId, false);
    await stopped;
  });
});
