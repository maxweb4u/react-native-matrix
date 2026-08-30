import { act } from '@testing-library/react-native';

import { createFakeSession, fakeEvent } from '../testing/fakeSession';
import { renderMatrixHook } from '../testing/renderWithMatrix';
import { useReceipts } from '../useReceipts';

const ROOM_ID = '!room:localhost';

const members = [
  { userId: '@alice:localhost' },
  { userId: '@bob:localhost' },
  { userId: '@carol:localhost' },
];

describe('useReceipts', () => {
  it('reads the receipts already in the room', async () => {
    const fake = createFakeSession({
      members,
      receipts: { '@bob:localhost': '$2', '@carol:localhost': '$1' },
    });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    expect(result.current.readUpTo).toEqual({
      '@bob:localhost': '$2',
      '@carol:localhost': '$1',
    });
  });

  it('leaves out the local user, whose own read state is not a receipt to show', async () => {
    const fake = createFakeSession({
      userId: '@alice:localhost',
      members,
      receipts: { '@alice:localhost': '$3', '@bob:localhost': '$2' },
    });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    expect(result.current.readUpTo).toEqual({ '@bob:localhost': '$2' });
  });

  it('leaves out members who have read nothing', async () => {
    const fake = createFakeSession({ members, receipts: { '@bob:localhost': '$2' } });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    expect(Object.keys(result.current.readUpTo)).toEqual(['@bob:localhost']);
  });

  it('is empty for a room that has not synced', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useReceipts('!unknown:localhost'));

    expect(result.current.readUpTo).toEqual({});
    expect(result.current.readersOf('$1')).toEqual([]);
  });

  it('picks up a receipt that arrives for this room', async () => {
    const fake = createFakeSession({ members, receipts: {} });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));
    expect(result.current.readUpTo).toEqual({});

    await act(async () => {
      fake.room.__setReceipt('@bob:localhost', '$5');
      fake.emitReceipt(ROOM_ID);
    });

    expect(result.current.readUpTo).toEqual({ '@bob:localhost': '$5' });
  });

  it('ignores a receipt for a different room', async () => {
    const fake = createFakeSession({ members, rooms: [{ roomId: '!other:localhost' }] });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    await act(async () => {
      fake.room.__setReceipt('@bob:localhost', '$5');
      fake.emitReceipt('!other:localhost');
    });

    expect(result.current.readUpTo).toEqual({});
  });

  it('keeps the same object when a receipt repeats, so nothing re-renders', async () => {
    // Receipts arrive constantly and rarely change what is on screen. The
    // equality check is the reason this hook is separate from useTimeline.
    const fake = createFakeSession({ members, receipts: { '@bob:localhost': '$2' } });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));
    const first = result.current.readUpTo;

    await act(async () => {
      fake.emitReceipt(ROOM_ID);
    });

    expect(result.current.readUpTo).toBe(first);
  });

  it('replaces the object when a receipt actually moves', async () => {
    const fake = createFakeSession({ members, receipts: { '@bob:localhost': '$2' } });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));
    const first = result.current.readUpTo;

    await act(async () => {
      fake.room.__setReceipt('@bob:localhost', '$3');
      fake.emitReceipt(ROOM_ID);
    });

    expect(result.current.readUpTo).not.toBe(first);
    expect(result.current.readUpTo['@bob:localhost']).toBe('$3');
  });

  it('replaces the object when a reader is added at the same event', async () => {
    // Same values on the shared keys, one key more: comparing lengths alone
    // would miss it, comparing values alone would too.
    const fake = createFakeSession({ members, receipts: { '@bob:localhost': '$2' } });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));
    const first = result.current.readUpTo;

    await act(async () => {
      fake.room.__setReceipt('@carol:localhost', '$2');
      fake.emitReceipt(ROOM_ID);
    });

    expect(result.current.readUpTo).not.toBe(first);
    expect(Object.keys(result.current.readUpTo).sort()).toEqual([
      '@bob:localhost',
      '@carol:localhost',
    ]);
  });

  it('names the users whose receipt is at a given event', async () => {
    const fake = createFakeSession({
      userId: '@alice:localhost',
      members,
      events: [fakeEvent({ id: '$2', sender: '@alice:localhost', ts: 2000 })],
      receipts: { '@bob:localhost': '$2', '@carol:localhost': '$2' },
    });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    expect(result.current.readersOf('$2').sort()).toEqual(['@bob:localhost', '@carol:localhost']);
  });

  it('does not count the local user among the readers of their own message', async () => {
    const fake = createFakeSession({
      userId: '@alice:localhost',
      members,
      events: [fakeEvent({ id: '$2', sender: '@alice:localhost', ts: 2000 })],
      receipts: { '@alice:localhost': '$2', '@bob:localhost': '$2' },
    });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    expect(result.current.readersOf('$2')).toEqual(['@bob:localhost']);
  });

  it('returns no readers for an event the room does not hold', async () => {
    const fake = createFakeSession({ members, receipts: { '@bob:localhost': '$2' } });

    const { result } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));

    expect(result.current.readersOf('$missing')).toEqual([]);
  });

  it('unsubscribes on unmount', async () => {
    const fake = createFakeSession({ members });

    const { unmount } = await renderMatrixHook(fake, () => useReceipts(ROOM_ID));
    await unmount();

    expect(fake.emitter.listenerCount('receipt')).toBe(0);
  });
});
