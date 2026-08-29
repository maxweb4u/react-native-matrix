import { type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { MatrixSession } from '../core/MatrixSession';
import { RoomTimeline } from '../timeline/RoomTimeline';
import type { MatrixAdapters, SessionOptions, SessionStatus } from '../types';
import { MatrixContext, type MatrixContextValue } from './context';

export interface MatrixProviderProps extends SessionOptions {
  children: ReactNode;
  /**
   * Rendered until the first sync completes. Without it, children render
   * immediately and can read `useMatrix().status.isReady` themselves.
   */
  fallback?: ReactNode;
  /**
   * Reuses an externally owned session instead of creating one. The provider
   * then neither starts nor stops it — ownership stays with the caller.
   */
  session?: MatrixSession;
}

/**
 * Owns one Matrix session for the tree below it.
 *
 * Room timelines are reference-counted here rather than created per hook, so
 * two screens showing the same room share one subscription and one store, and
 * the timeline is torn down only when the last of them unmounts.
 *
 * See memory_bank/adr/ADR-002-session-instance-over-singleton.md.
 */
export function MatrixProvider({
  children,
  fallback,
  session: externalSession,
  ...options
  // `ReactElement`, not `ReactNode`: React 18's JSX types reject a component
  // whose return type includes `undefined`, so declaring the wider type made
  // `<MatrixProvider>` unusable in a consumer's own tree.
}: MatrixProviderProps): ReactElement {
  const ownsSession = externalSession === undefined;

  const [session] = useState(() => externalSession ?? new MatrixSession(options));
  const [status, setStatus] = useState<SessionStatus>(() => session.getStatus());
  const [startError, setStartError] = useState<Error | null>(null);

  // Timelines outlive individual renders, so they live in a ref rather than
  // state: acquiring one must not schedule a re-render of the provider.
  const timelines = useRef(new Map<string, { timeline: RoomTimeline; refCount: number }>());

  useEffect(() => {
    const unsubscribe = session.on('status', setStatus);
    return unsubscribe;
  }, [session]);

  useEffect(() => {
    if (!ownsSession) {
      return;
    }
    let cancelled = false;
    // Captured for the cleanup: the ref itself may be reassigned by then.
    const openTimelines = timelines.current;

    session.start().catch((error: unknown) => {
      if (!cancelled) {
        setStartError(error instanceof Error ? error : new Error(String(error)));
      }
    });

    return () => {
      cancelled = true;
      for (const entry of openTimelines.values()) {
        entry.timeline.stop();
      }
      openTimelines.clear();
      session.stop();
    };
  }, [session, ownsSession]);

  const value = useMemo<MatrixContextValue>(
    () => ({
      session,
      acquireTimeline: (roomId: string) => {
        const existing = timelines.current.get(roomId);
        if (existing) {
          existing.refCount += 1;
          return existing.timeline;
        }
        const timeline = new RoomTimeline(session, roomId);
        timeline.start();
        timelines.current.set(roomId, { timeline, refCount: 1 });
        return timeline;
      },
      releaseTimeline: (roomId: string) => {
        const entry = timelines.current.get(roomId);
        if (!entry) {
          return;
        }
        entry.refCount -= 1;
        if (entry.refCount <= 0) {
          entry.timeline.stop();
          timelines.current.delete(roomId);
        }
      },
    }),
    [session],
  );

  if (startError) {
    // Surfacing through the callback keeps the library out of the consumer's
    // console while still letting an error boundary catch a fatal start.
    options.onError?.(startError);
    throw startError;
  }

  return (
    <MatrixContext.Provider value={value}>
      {!status.isReady && fallback !== undefined ? fallback : children}
    </MatrixContext.Provider>
  );
}

/** Convenience re-export so consumers can type an adapters object inline. */
export type { MatrixAdapters };
