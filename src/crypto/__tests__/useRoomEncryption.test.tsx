import { act } from '@testing-library/react-native';

import { createFakeSession } from '../../react/testing/fakeSession';
import { renderMatrixHook } from '../../react/testing/renderWithMatrix';
import { useRoomEncryption } from '../useRoomEncryption';

const ROOM_ID = '!room:localhost';

describe('useRoomEncryption', () => {
  it('reports an unencrypted room', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));

    expect(result.current.isEncrypted).toBe(false);
  });

  it('reports an encrypted room', async () => {
    const fake = createFakeSession({ encrypted: true });

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));

    expect(result.current.isEncrypted).toBe(true);
  });

  it('reports an unknown room as unencrypted rather than throwing', async () => {
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption('!unknown:localhost'));

    expect(result.current.isEncrypted).toBe(false);
  });

  it('follows the crypto backend through the session status', async () => {
    const fake = createFakeSession({ isCryptoEnabled: false });

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));
    expect(result.current.isCryptoEnabled).toBe(false);

    await act(async () => {
      fake.setStatus({ isCryptoEnabled: true });
    });

    expect(result.current.isCryptoEnabled).toBe(true);
  });

  it('notices a room becoming encrypted while the screen is open', async () => {
    // Read from state on every change rather than cached: a lock icon one sync
    // behind is worse than no lock icon.
    const fake = createFakeSession();

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));
    expect(result.current.isEncrypted).toBe(false);

    await act(async () => {
      fake.room.__setEncrypted(true);
      fake.emitRoomSummary(ROOM_ID);
    });

    expect(result.current.isEncrypted).toBe(true);
  });

  it('ignores a change to a different room', async () => {
    const fake = createFakeSession({ rooms: [{ roomId: '!other:localhost' }] });

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));

    await act(async () => {
      fake.room.__setEncrypted(true);
      fake.emitRoomSummary('!other:localhost');
    });

    expect(result.current.isEncrypted).toBe(false);
  });

  it('writes the megolm state event when enabling', async () => {
    const fake = createFakeSession({ isCryptoEnabled: true });

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));
    await act(async () => {
      await result.current.enable();
    });

    expect(fake.stateEvents).toEqual([
      {
        roomId: ROOM_ID,
        type: 'm.room.encryption',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
        stateKey: '',
      },
    ]);
  });

  it('writes nothing for a room that is already encrypted', async () => {
    // A second state event would rotate the megolm session for no reason.
    const fake = createFakeSession({ isCryptoEnabled: true, encrypted: true });

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));
    await act(async () => {
      await result.current.enable();
    });

    expect(fake.stateEvents).toEqual([]);
  });

  it('refuses to encrypt a room this session could not then read', async () => {
    const fake = createFakeSession({ isCryptoEnabled: false });

    const { result } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));

    await expect(result.current.enable()).rejects.toThrow('crypto.enabled');
    expect(fake.stateEvents).toEqual([]);
  });

  it('unsubscribes from both events on unmount', async () => {
    const fake = createFakeSession();

    const { unmount } = await renderMatrixHook(fake, () => useRoomEncryption(ROOM_ID));
    await unmount();

    expect(fake.emitter.listenerCount('roomSummary')).toBe(0);
    expect(fake.emitter.listenerCount('status')).toBe(0);
  });
});
