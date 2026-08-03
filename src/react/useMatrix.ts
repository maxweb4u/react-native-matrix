import { useCallback, useSyncExternalStore } from 'react';

import type { MatrixSession } from '../core/MatrixSession';
import type { SessionStatus } from '../types';
import { useMatrixContext } from './context';

export interface UseMatrixResult {
  session: MatrixSession;
  status: SessionStatus;
  /** The logged-in user's Matrix ID. */
  userId: string;
}

/**
 * Access to the session and its live status.
 *
 * The status object is produced by the session itself, so identity is stable
 * between changes and this hook does not re-render on every sync tick.
 */
export function useMatrix(): UseMatrixResult {
  const { session } = useMatrixContext('useMatrix');

  const subscribe = useCallback(
    (onChange: () => void) => session.on('status', onChange),
    [session],
  );
  const status = useSyncExternalStore(subscribe, () => session.getStatus());

  return { session, status, userId: session.userId };
}
