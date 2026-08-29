import { useCallback, useSyncExternalStore } from 'react';

import { useMatrixContext } from '../react/context';
import { enableRoomEncryption } from './roomEncryption';

export interface UseRoomEncryptionResult {
  /** True when the room carries an `m.room.encryption` state event. */
  isEncrypted: boolean;
  /** True when this session has a working crypto backend. */
  isCryptoEnabled: boolean;
  /**
   * Turns on encryption for this room. Irreversible — see
   * {@link enableRoomEncryption}.
   */
  enable: () => Promise<void>;
}

/**
 * Encryption state of one room.
 *
 * Read from room state on every change rather than cached: a room can become
 * encrypted while the screen is open, and rendering a lock icon that is one
 * sync behind is worse than rendering none.
 */
export function useRoomEncryption(roomId: string): UseRoomEncryptionResult {
  const { session } = useMatrixContext('useRoomEncryption');

  const subscribe = useCallback(
    (onChange: () => void) => {
      const unsubscribers = [
        session.on('roomSummary', ({ roomId: changed }) => {
          if (changed === roomId) {
            onChange();
          }
        }),
        session.on('status', onChange),
      ];
      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      };
    },
    [session, roomId],
  );

  const isEncrypted = useSyncExternalStore(subscribe, () => session.isRoomEncrypted(roomId));
  const isCryptoEnabled = useSyncExternalStore(
    subscribe,
    () => session.getStatus().isCryptoEnabled,
  );

  const enable = useCallback(
    () => enableRoomEncryption(session, roomId),
    [session, roomId],
  );

  return { isEncrypted, isCryptoEnabled, enable };
}
