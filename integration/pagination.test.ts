/**
 * Loading older messages.
 *
 * Pagination needs a room with real history behind the sync window, which is
 * why it belongs here rather than in the unit suite.
 */

import type { MatrixSession } from '../src/core/MatrixSession';
import { ALICE, BOB, requireHomeserver } from './support/homeserver';
import {
  createSharedRoom,
  openTimeline,
  startSession,
  stopEverything,
  waitFor,
} from './support/harness';

const HISTORY = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

let alice: MatrixSession;
let bob: MatrixSession;
let roomId: string;

beforeAll(async () => {
  await requireHomeserver();
  [alice, bob] = await Promise.all([startSession(ALICE), startSession(BOB)]);
  roomId = await createSharedRoom(alice, bob, { name: 'Pagination' });

  // Sequential, so the room history is in a known order.
  for (const body of HISTORY) {
    await alice.sendText(roomId, body);
  }
});

afterAll(() => {
  stopEverything();
});

describe('paginateBack', () => {
  it('loads older messages without duplicating rows', async () => {
    // A narrow initial sync leaves most of the history off-screen, which is
    // the state a real client is in when a user scrolls up.
    const late = await startSession(BOB, { initialSyncLimit: 3 });
    await waitFor('the room to sync into the new session', () =>
      late.getClient().getRoom(roomId),
    );

    const timeline = openTimeline(late, roomId);
    await waitFor('the initial window to hydrate', () => timeline.getSnapshot().length > 0);

    const initial = timeline.getSnapshot().length;
    expect(initial).toBeLessThan(HISTORY.length);

    await timeline.paginateBack(50);

    const items = timeline.getSnapshot();
    expect(items.length).toBeGreaterThan(initial);

    // The store is keyed by event ID, so a page that overlaps the loaded
    // window must merge rather than append.
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);

    for (const body of HISTORY) {
      expect(items.some((item) => item.body === body)).toBe(true);
    }

    // Newest first, as the chat view renders it.
    const timestamps = items.map((item) => item.ts);
    expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
  });

  it('collapses concurrent pagination requests into one', async () => {
    const late = await startSession(BOB, { initialSyncLimit: 3 });
    await waitFor('the room to sync into the new session', () =>
      late.getClient().getRoom(roomId),
    );

    const timeline = openTimeline(late, roomId);
    await waitFor('the initial window to hydrate', () => timeline.getSnapshot().length > 0);

    // A fast scroll fires the end-reached callback repeatedly; 0.0.x issued a
    // request for every one of them.
    const [first, ...rest] = await Promise.all([
      timeline.paginateBack(50),
      timeline.paginateBack(50),
      timeline.paginateBack(50),
    ]);

    expect(typeof first).toBe('boolean');
    expect(rest.every((result) => typeof result === 'boolean')).toBe(true);
    expect(timeline.isPaginating).toBe(false);

    const items = timeline.getSnapshot();
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
