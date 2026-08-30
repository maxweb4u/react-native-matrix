import { act } from '@testing-library/react-native';

import { createFakeSession, fakeEvent, type FakeSession } from '../testing/fakeSession';
import { renderMatrixHook } from '../testing/renderWithMatrix';
import { useRooms, type UseRoomsOptions } from '../useRooms';

/**
 * Three rooms, deliberately out of order and of mixed membership, so the
 * ordering assertions cannot pass by accident of insertion order.
 */
function threeRooms(): FakeSession {
  return createFakeSession({
    roomId: '!oldest:localhost',
    name: 'Gardening',
    events: [fakeEvent({ id: '$a', sender: '@bob:localhost', ts: 1000 })],
    unreadCount: 2,
    rooms: [
      {
        roomId: '!newest:localhost',
        name: 'Deployments',
        events: [fakeEvent({ id: '$b', sender: '@bob:localhost', ts: 9000 })],
        unreadCount: 5,
      },
      {
        roomId: '!middle:localhost',
        name: 'Design',
        events: [fakeEvent({ id: '$c', sender: '@bob:localhost', ts: 5000 })],
      },
    ],
  });
}

const idsOf = (rooms: { id: string }[]): string[] => rooms.map((room) => room.id);

describe('useRooms', () => {
  it('returns every joined room, newest activity first', async () => {
    const { result } = await renderMatrixHook(threeRooms(), () => useRooms());

    expect(idsOf(result.current.rooms)).toEqual([
      '!newest:localhost',
      '!middle:localhost',
      '!oldest:localhost',
    ]);
  });

  it('sums the unread counts of the rooms it returns', async () => {
    const { result } = await renderMatrixHook(threeRooms(), () => useRooms());

    expect(result.current.totalUnread).toBe(7);
  });

  it('drops rooms the user has left, which the SDK store keeps', async () => {
    const fake = createFakeSession({
      roomId: '!joined:localhost',
      rooms: [{ roomId: '!gone:localhost', membership: 'leave' }],
    });

    const { result } = await renderMatrixHook(fake, () => useRooms());

    expect(idsOf(result.current.rooms)).toEqual(['!joined:localhost']);
  });

  it('pins pending invites above everything, however old', async () => {
    const fake = createFakeSession({
      roomId: '!busy:localhost',
      events: [fakeEvent({ id: '$a', sender: '@bob:localhost', ts: 9000 })],
      rooms: [{ roomId: '!invite:localhost', membership: 'invite', lastActivityTs: 1 }],
    });

    const { result } = await renderMatrixHook(fake, () => useRooms());

    expect(idsOf(result.current.rooms)).toEqual(['!invite:localhost', '!busy:localhost']);
  });

  it('hides invites on request, and drops their unread counts with them', async () => {
    const fake = createFakeSession({
      roomId: '!busy:localhost',
      unreadCount: 1,
      rooms: [{ roomId: '!invite:localhost', membership: 'invite', unreadCount: 4 }],
    });

    const { result } = await renderMatrixHook(fake, () => useRooms({ hideInvites: true }));

    expect(idsOf(result.current.rooms)).toEqual(['!busy:localhost']);
    expect(result.current.totalUnread).toBe(1);
  });

  it('filters by name without regard to case, and ignores surrounding space', async () => {
    const { result } = await renderMatrixHook(threeRooms(), () =>
      useRooms({ search: '  DEPLOY ' }),
    );

    expect(idsOf(result.current.rooms)).toEqual(['!newest:localhost']);
  });

  it('treats a blank search as no search at all', async () => {
    const { result } = await renderMatrixHook(threeRooms(), () => useRooms({ search: '   ' }));

    expect(result.current.rooms).toHaveLength(3);
  });

  it('returns nothing when the search matches nothing', async () => {
    const { result } = await renderMatrixHook(threeRooms(), () => useRooms({ search: 'zzz' }));

    expect(result.current.rooms).toEqual([]);
    expect(result.current.totalUnread).toBe(0);
  });

  it('marks a room direct from m.direct account data, not from the timeline', async () => {
    // 0.0.x looked for is_direct on a membership event in the loaded window,
    // so a long conversation stopped being direct. Account data does not age.
    const fake = createFakeSession({
      roomId: '!dm:localhost',
      members: [{ userId: '@bob:localhost', avatarMxcUri: 'mxc://localhost/bob' }],
      directRooms: { '@bob:localhost': ['!dm:localhost'] },
    });

    const { result } = await renderMatrixHook(fake, () => useRooms());

    expect(result.current.rooms[0]?.isDirect).toBe(true);
    expect(result.current.rooms[0]?.directUserId).toBe('@bob:localhost');
    expect(result.current.rooms[0]?.avatarMxcUri).toBe('mxc://localhost/bob');
  });

  it('rebuilds the list when the session reports a room change', async () => {
    const fake = createFakeSession({ roomId: '!a:localhost' });

    const { result } = await renderMatrixHook(fake, () => useRooms());
    expect(result.current.rooms[0]?.lastMessage).toBeNull();

    await act(async () => {
      fake.room.addEvent(fakeEvent({ id: '$new', sender: '@bob:localhost', ts: 4000 }));
      fake.emitRoomSummary('!a:localhost');
    });

    expect(result.current.rooms[0]?.lastMessage?.body).toBe('body-$new');
  });

  it('rebuilds on a status change too, which is what ends the empty first sync', async () => {
    const fake = createFakeSession({ roomId: '!a:localhost' });

    const { result } = await renderMatrixHook(fake, () => useRooms());
    await act(async () => {
      fake.room.addEvent(fakeEvent({ id: '$new', sender: '@bob:localhost', ts: 4000 }));
      fake.setStatus({ syncState: 'syncing' });
    });

    expect(result.current.rooms[0]?.lastMessage?.body).toBe('body-$new');
  });

  it('hands back the same array when nothing changed', async () => {
    // The cache is what keeps a long list from re-rendering on unrelated
    // traffic: useSyncExternalStore compares snapshots by identity.
    const fake = threeRooms();
    let renders = 0;

    const { result, rerender } = await renderMatrixHook(fake, () => {
      renders += 1;
      return useRooms();
    });
    const first = result.current.rooms;
    await rerender(undefined as never);

    expect(result.current.rooms).toBe(first);
    expect(renders).toBeGreaterThan(1);
  });

  it('accepts an invite through the session', async () => {
    const fake = createFakeSession({ roomId: '!invite:localhost', membership: 'invite' });

    const { result } = await renderMatrixHook(fake, () => useRooms());
    await act(async () => {
      await result.current.acceptInvite('!invite:localhost');
    });

    expect(fake.joined).toEqual(['!invite:localhost']);
  });

  it('declines an invite through the session', async () => {
    const fake = createFakeSession({ roomId: '!invite:localhost', membership: 'invite' });

    const { result } = await renderMatrixHook(fake, () => useRooms());
    await act(async () => {
      await result.current.declineInvite('!invite:localhost');
    });

    expect(fake.left).toEqual(['!invite:localhost']);
  });

  it('unsubscribes from both events on unmount', async () => {
    const fake = createFakeSession();

    const { unmount } = await renderMatrixHook(fake, () => useRooms());
    await unmount();

    expect(fake.emitter.listenerCount('roomSummary')).toBe(0);
    expect(fake.emitter.listenerCount('status')).toBe(0);
  });

  it('takes no options at all', async () => {
    const options: UseRoomsOptions = {};

    const { result } = await renderMatrixHook(threeRooms(), () => useRooms(options));

    expect(result.current.rooms).toHaveLength(3);
  });
});
