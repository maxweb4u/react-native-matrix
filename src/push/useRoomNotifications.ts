import { useCallback, useEffect, useRef, useState } from 'react';

import { useMatrixContext } from '../react/context';
import { NotificationLevel } from '../types/push';

export interface UseRoomNotificationsResult {
  level: NotificationLevel;
  /** True until the account's push rules have been read for this room. */
  isLoading: boolean;
  /** Null unless reading or writing the rules failed. */
  error: Error | null;
  setLevel: (level: NotificationLevel) => Promise<void>;
}

interface State {
  /** The room this state belongs to, so a switch is visible during render. */
  roomId: string;
  level: NotificationLevel;
  isLoading: boolean;
  error: Error | null;
}

const initial = (roomId: string): State => ({
  roomId,
  level: NotificationLevel.All,
  isLoading: true,
  error: null,
});

/**
 * What one room notifies for, and how to change it.
 *
 * Push rules live on the account rather than in the sync stream, so this hook
 * fetches rather than subscribes. The optimistic update in `setLevel` is the
 * point: a settings control that waits for a round trip before moving reads as
 * broken, and it is put back if the write fails.
 */
export function useRoomNotifications(roomId: string): UseRoomNotificationsResult {
  const { session } = useMatrixContext('useRoomNotifications');
  const [state, setState] = useState<State>(() => initial(roomId));
  /**
   * Counts local writes. The initial read is slower than a tap: without this,
   * a user who toggles the control immediately after opening the screen sees
   * it snap back when the in-flight read lands.
   */
  const writes = useRef(0);

  // Adjusting state during render, not in an effect: this is state derived
  // from a prop, and resetting it in an effect would render one frame of the
  // previous room's setting first.
  if (state.roomId !== roomId) {
    setState(initial(roomId));
  }

  useEffect(() => {
    let cancelled = false;
    const generation = writes.current;
    session
      .getNotificationLevel(roomId)
      .then((level) => {
        if (cancelled) {
          return;
        }
        setState((current) =>
          // A level chosen while the read was in flight wins over the read.
          writes.current === generation
            ? { roomId, level, isLoading: false, error: null }
            : { ...current, isLoading: false },
        );
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setState((current) => ({ ...current, isLoading: false, error: cause as Error }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, roomId]);

  const setLevel = useCallback(
    async (next: NotificationLevel) => {
      // Read from the closure rather than from inside the updater: React may
      // invoke an updater twice, and the second run would capture the value we
      // just set, making the revert a no-op.
      const previous = state.level;
      writes.current += 1;
      setState((current) => ({ ...current, level: next, error: null }));
      try {
        await session.setNotificationLevel(roomId, next);
      } catch (cause) {
        // Put the control back: leaving it on the value the user chose would
        // claim a setting the homeserver never accepted.
        setState((current) => ({ ...current, level: previous, error: cause as Error }));
        throw cause;
      }
    },
    [session, roomId, state.level],
  );

  return { level: state.level, isLoading: state.isLoading, error: state.error, setLevel };
}
