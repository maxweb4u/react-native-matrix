/**
 * Login, sync, and room membership against a real homeserver.
 *
 * See memory_bank/engineering/testing-policy.md#what-integration-tests-own.
 */

import type { MatrixSession } from '../src/core/MatrixSession';
import { RoomNotFoundError, SessionNotReadyError } from '../src/core/errors';
import { buildRoomSummary } from '../src/timeline/roomSummary';
import { ALICE, BOB, requireHomeserver } from './support/homeserver';
import { startSession, stopEverything, waitFor } from './support/harness';

let alice: MatrixSession;
let bob: MatrixSession;

beforeAll(async () => {
  await requireHomeserver();
  [alice, bob] = await Promise.all([startSession(ALICE), startSession(BOB)]);
});

afterAll(() => {
  stopEverything();
});

describe('session lifecycle', () => {
  it('is ready and syncing once start resolves', () => {
    const status = alice.getStatus();

    expect(status.isReady).toBe(true);
    expect(status.syncState).toBe('syncing');
    expect(status.error).toBeNull();
    // Crypto is opt-in; a session that did not ask for it must not claim it.
    expect(status.isCryptoEnabled).toBe(false);
  });

  it('names the room in the error when one is not synced', () => {
    expect(() => alice.getRoom('!never-joined:localhost')).toThrow(RoomNotFoundError);
    expect(() => alice.getRoom('!never-joined:localhost')).toThrow('!never-joined:localhost');
  });

  it('reports a stopped session instead of using a dead client', async () => {
    const throwaway = await startSession(BOB);
    throwaway.stop();

    expect(throwaway.getStatus().syncState).toBe('stopped');
    expect(() => throwaway.getClient()).toThrow(SessionNotReadyError);
  });
});

describe('invitations', () => {
  it('makes an accepted invite visible in the chat list', async () => {
    const roomId = await alice.createRoom({
      name: 'Invite round-trip',
      invite: [BOB.userId],
    });

    const invited = await waitFor(`${BOB.userId} to receive the invite`, () => {
      const room = bob.getClient().getRoom(roomId);
      return room?.getMyMembership() === 'invite' ? room : null;
    });
    expect(buildRoomSummary(invited, { client: bob.getClient() }).membership).toBe('invite');

    await bob.joinRoom(roomId);

    // 0.0.x called the SDK join helper with the wrong arity, so the local
    // membership never advanced and an accepted invite stayed invisible in the
    // chat list until the application restarted.
    const joined = await waitFor(`${BOB.userId} to be joined`, () => {
      const room = bob.getClient().getRoom(roomId);
      return room?.getMyMembership() === 'join' ? room : null;
    });

    const summary = buildRoomSummary(joined, { client: bob.getClient() });
    expect(summary.membership).toBe('join');
    expect(summary.name).toBe('Invite round-trip');
    expect(summary.isEncrypted).toBe(false);
    expect(bob.getRooms().map((room) => room.roomId)).toContain(roomId);
  });

  it('records a direct room as direct for both participants', async () => {
    const roomId = await alice.createRoom({ isDirect: true, invite: [BOB.userId] });

    await waitFor(`${BOB.userId} to receive the direct invite`, () =>
      bob.getClient().getRoom(roomId) ? true : null,
    );
    await bob.joinRoom(roomId);
    await waitFor(`${BOB.userId} to be joined`, () =>
      bob.getClient().getRoom(roomId)?.getMyMembership() === 'join',
    );

    // Direct rooms are resolved from `m.direct` account data rather than from
    // the `is_direct` flag on the invite: 0.0.x read the flag off a membership
    // event in the loaded window, so a conversation that grew past that window
    // silently started rendering as a group room.
    const asSeenByBob = await waitFor('bob to record the room as direct', () => {
      const room = bob.getClient().getRoom(roomId);
      if (!room) {
        return null;
      }
      const summary = buildRoomSummary(room, { client: bob.getClient() });
      return summary.isDirect ? summary : null;
    });
    expect(asSeenByBob.directUserId).toBe(ALICE.userId);

    const asSeenByAlice = await waitFor('alice to record the room as direct', () => {
      const room = alice.getClient().getRoom(roomId);
      if (!room) {
        return null;
      }
      const summary = buildRoomSummary(room, { client: alice.getClient() });
      return summary.isDirect ? summary : null;
    });
    expect(asSeenByAlice.directUserId).toBe(BOB.userId);
  });
});

describe('leaving', () => {
  it('drops a left room from the visible list', async () => {
    const roomId = await alice.createRoom({ name: 'Temporary' });
    await waitFor('the new room to sync', () => alice.getClient().getRoom(roomId));

    await alice.leaveRoom(roomId);

    await waitFor('the room to disappear from the chat list', () =>
      alice.getRooms().every((room) => room.roomId !== roomId),
    );
  });
});
