import { act } from '@testing-library/react-native';

import { createFakeSession } from '../../react/testing/fakeSession';
import { renderMatrixHook } from '../../react/testing/renderWithMatrix';
import { NotificationLevel } from '../../types/push';
import { useRoomNotifications } from '../useRoomNotifications';

const ROOM = '!room:localhost';

describe('useRoomNotifications', () => {
  it('reads the current level once mounted', async () => {
    const fake = createFakeSession({ notificationLevel: NotificationLevel.Mentions });

    const { result } = await renderMatrixHook(fake, () => useRoomNotifications(ROOM));

    expect(result.current.level).toBe(NotificationLevel.Mentions);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('moves the control immediately, before the homeserver answers', async () => {
    // A settings toggle that waits for a round trip reads as broken.
    const fake = createFakeSession();
    fake.holdNotificationWrite();

    const { result } = await renderMatrixHook(fake, () => useRoomNotifications(ROOM));
    let pending: Promise<void> | null = null;
    await act(async () => {
      pending = result.current.setLevel(NotificationLevel.Mute);
    });

    expect(result.current.level).toBe(NotificationLevel.Mute);
    expect(fake.notificationWrites).toEqual([]);

    await act(async () => {
      fake.releaseNotificationWrite();
      await pending;
    });
    expect(fake.notificationWrites).toEqual([{ roomId: ROOM, level: NotificationLevel.Mute }]);
  });

  it('keeps a level chosen while the initial read was still in flight', async () => {
    // The read is a round trip and a tap is not. Applying the read's answer
    // unconditionally snaps the control back under the user's finger, and the
    // value it snaps to is the one the user just replaced.
    const fake = createFakeSession({ notificationLevel: NotificationLevel.All });
    fake.holdNotificationRead();

    const { result } = await renderMatrixHook(fake, () => useRoomNotifications(ROOM));
    await act(async () => {
      await result.current.setLevel(NotificationLevel.Mute);
    });
    expect(result.current.level).toBe(NotificationLevel.Mute);

    await act(async () => {
      fake.releaseNotificationRead();
    });

    expect(result.current.level).toBe(NotificationLevel.Mute);
    expect(result.current.isLoading).toBe(false);
  });

  it('puts the control back when the write fails', async () => {
    // Leaving it on the chosen value claims a setting the homeserver refused.
    const fake = createFakeSession({ notificationLevel: NotificationLevel.All });
    fake.failNotificationWrite(new Error('M_FORBIDDEN'));

    const { result } = await renderMatrixHook(fake, () => useRoomNotifications(ROOM));
    await act(async () => {
      await expect(result.current.setLevel(NotificationLevel.Mute)).rejects.toThrow('M_FORBIDDEN');
    });

    expect(result.current.level).toBe(NotificationLevel.All);
    expect(result.current.error?.message).toBe('M_FORBIDDEN');
  });

  it('surfaces a failure to read the rules without crashing the screen', async () => {
    const fake = createFakeSession();
    fake.failNotificationRead(new Error('offline'));

    const { result } = await renderMatrixHook(fake, () => useRoomNotifications(ROOM));

    expect(result.current.error?.message).toBe('offline');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.level).toBe(NotificationLevel.All);
  });

  it('shows no level from the previous room while the new one loads', async () => {
    // The reset happens during render rather than in an effect. In an effect
    // it would render one frame of the previous room's setting under the new
    // room's name, which is a settings screen showing someone else's answer.
    const fake = createFakeSession({
      notificationLevel: NotificationLevel.Mute,
      rooms: [{ roomId: '!other:localhost' }],
    });
    fake.setNotificationLevelFor('!other:localhost', NotificationLevel.Mentions);
    let roomId = ROOM;

    const { result, rerender } = await renderMatrixHook(fake, () => useRoomNotifications(roomId));
    expect(result.current.level).toBe(NotificationLevel.Mute);

    fake.holdNotificationRead();
    roomId = '!other:localhost';
    await rerender(undefined as never);

    expect(result.current.isLoading).toBe(true);
    expect(result.current.level).toBe(NotificationLevel.All);

    await act(async () => {
      fake.releaseNotificationRead();
    });
    expect(result.current.level).toBe(NotificationLevel.Mentions);
  });

  it('clears a previous error when a new write starts', async () => {
    const fake = createFakeSession();
    fake.failNotificationWrite(new Error('M_FORBIDDEN'));

    const { result } = await renderMatrixHook(fake, () => useRoomNotifications(ROOM));
    await act(async () => {
      await expect(result.current.setLevel(NotificationLevel.Mute)).rejects.toThrow();
    });
    expect(result.current.error).not.toBeNull();

    fake.failNotificationWrite(null);
    await act(async () => {
      await result.current.setLevel(NotificationLevel.Mentions);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.level).toBe(NotificationLevel.Mentions);
  });
});
