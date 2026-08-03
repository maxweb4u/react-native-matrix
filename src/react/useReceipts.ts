import { useCallback, useEffect, useState } from 'react';

import { useMatrixContext } from './context';

export interface UseReceiptsResult {
  /**
   * Event ID each member has read up to, excluding the local user.
   * A message is "read by" a user when it is at or before their entry.
   */
  readUpTo: Readonly<Record<string, string>>;
  /** User IDs that have read the given event or something newer. */
  readersOf: (eventId: string) => string[];
}

/**
 * Read receipts for one room.
 *
 * Receipts arrive frequently and rarely change what is on screen, so this hook
 * is separate from `useTimeline`: a component that does not render read state
 * never re-renders because of one.
 */
export function useReceipts(roomId: string): UseReceiptsResult {
  const { session } = useMatrixContext('useReceipts');
  const [readUpTo, setReadUpTo] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    const collect = () => {
      let room;
      try {
        room = session.getRoom(roomId);
      } catch {
        return;
      }
      const next: Record<string, string> = {};
      for (const member of room.getMembers()) {
        if (member.userId === session.userId) {
          continue;
        }
        const eventId = room.getEventReadUpTo(member.userId);
        if (eventId) {
          next[member.userId] = eventId;
        }
      }
      setReadUpTo((previous) => {
        const previousKeys = Object.keys(previous);
        const nextKeys = Object.keys(next);
        const unchanged =
          previousKeys.length === nextKeys.length &&
          nextKeys.every((key) => previous[key] === next[key]);
        return unchanged ? previous : next;
      });
    };

    collect();
    const unsubscribe = session.on('receipt', ({ roomId: changed }) => {
      if (changed === roomId) {
        collect();
      }
    });
    return unsubscribe;
  }, [session, roomId]);

  const readersOf = useCallback(
    (eventId: string) => {
      let room;
      try {
        room = session.getRoom(roomId);
      } catch {
        return [];
      }
      const event = room.findEventById(eventId);
      return event ? room.getUsersReadUpTo(event).filter((id) => id !== session.userId) : [];
    },
    [session, roomId],
  );

  return { readUpTo, readersOf };
}
