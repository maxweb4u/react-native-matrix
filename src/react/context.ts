import { createContext, useContext } from 'react';

import type { MatrixSession } from '../core/MatrixSession';
import { MatrixLibError } from '../core/errors';
import type { RoomTimeline } from '../timeline/RoomTimeline';

export interface MatrixContextValue {
  session: MatrixSession;
  /**
   * Acquires the shared timeline for a room, creating it on first use.
   * Reference-counted: the last release stops it.
   */
  acquireTimeline: (roomId: string) => RoomTimeline;
  releaseTimeline: (roomId: string) => void;
}

export const MatrixContext = createContext<MatrixContextValue | null>(null);

export class MatrixProviderMissingError extends MatrixLibError {
  public constructor(hookName: string) {
    super(
      `${hookName} must be called inside <MatrixProvider>. ` +
        `Wrap the screen — or the whole app — in <MatrixProvider credentials={…}>.`,
      'MatrixProviderMissingError',
    );
  }
}

/** Internal accessor shared by every hook. */
export function useMatrixContext(hookName: string): MatrixContextValue {
  const value = useContext(MatrixContext);
  if (!value) {
    throw new MatrixProviderMissingError(hookName);
  }
  return value;
}
