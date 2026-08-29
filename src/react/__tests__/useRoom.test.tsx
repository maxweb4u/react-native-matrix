import { act } from '@testing-library/react-native';

import { createFakeSession, fakeEvent } from '../testing/fakeSession';
import { renderMatrixHook } from '../testing/renderWithMatrix';
import { useRoom } from '../useRoom';

const ROOM_ID = '!room:localhost';

describe('useRoom', () => {
  it('returns the room summary', async () => {
    const fake = createFakeSession({
      name: 'Deployments',
      unreadCount: 3,
      events: [fakeEvent({ id: '$a', sender: '@bob:localhost', ts: 1000 })],
    });

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));

    expect(result.current.room?.id).toBe(ROOM_ID);
    expect(result.current.room?.name).toBe('Deployments');
    expect(result.current.room?.unreadCount).toBe(3);
  });

  it('returns null rather than throwing for a room that has not synced', async () => {
    // A screen opened from a push notification renders before the room exists.
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoom('!unknown:localhost'));

    expect(result.current.room).toBeNull();
    expect(result.current.members).toEqual([]);
  });

  it('lists joined and invited members, and no one else', async () => {
    const fake = createFakeSession({
      members: [
        { userId: '@alice:localhost' },
        { userId: '@bob:localhost', membership: 'invite' },
        { userId: '@carol:localhost', membership: 'leave' },
        { userId: '@dave:localhost', membership: 'ban' },
      ],
    });

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));

    expect(result.current.members.map((member) => member.userId)).toEqual([
      '@alice:localhost',
      '@bob:localhost',
    ]);
  });

  it('marks the local user among the members', async () => {
    const fake = createFakeSession({
      userId: '@alice:localhost',
      members: [{ userId: '@alice:localhost' }, { userId: '@bob:localhost' }],
    });

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));

    expect(result.current.members.find((m) => m.userId === '@alice:localhost')?.isSelf).toBe(true);
    expect(result.current.members.find((m) => m.userId === '@bob:localhost')?.isSelf).toBe(false);
  });

  it('updates when this room changes', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));
    expect(result.current.room?.lastMessage).toBeNull();

    await act(async () => {
      fake.room.addEvent(fakeEvent({ id: '$new', sender: '@bob:localhost', ts: 7000 }));
      fake.emitRoomSummary(ROOM_ID);
    });

    expect(result.current.room?.lastMessage?.body).toBe('body-$new');
  });

  it('ignores a change to a different room', async () => {
    // The whole point of subscribing per room: a busy room next door must not
    // re-render this screen.
    const fake = createFakeSession({ rooms: [{ roomId: '!other:localhost' }] });

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));
    const before = result.current.room;

    await act(async () => {
      fake.emitRoomSummary('!other:localhost');
    });

    expect(result.current.room).toBe(before);
  });

  it('renames the room through the session', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));
    await act(async () => {
      await result.current.rename('Renamed');
    });

    expect(fake.renames).toEqual([{ roomId: ROOM_ID, name: 'Renamed' }]);
  });

  it('invites through the session', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));
    await act(async () => {
      await result.current.invite(['@bob:localhost', '@carol:localhost']);
    });

    expect(fake.invites).toEqual([
      { roomId: ROOM_ID, userIds: ['@bob:localhost', '@carol:localhost'] },
    ]);
  });

  it('leaves through the session', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));
    await act(async () => {
      await result.current.leave();
    });

    expect(fake.left).toEqual([ROOM_ID]);
  });

  it('unsubscribes on unmount', async () => {
    const fake = createFakeSession();

    const { unmount } = await renderMatrixHook(fake, () => useRoom(ROOM_ID));
    await unmount();

    expect(fake.emitter.listenerCount('roomSummary')).toBe(0);
  });
});
