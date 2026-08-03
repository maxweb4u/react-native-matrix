import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import { buildRoomSummary, directRoomUserIds, sortRoomSummaries } from '../timeline/roomSummary';
import type { RoomSummary } from '../types';
import { useMatrixContext } from './context';

export interface UseRoomsOptions {
  /** Case-insensitive filter over room names. */
  search?: string;
  /** Excludes pending invites. They are included by default. */
  hideInvites?: boolean;
}

export interface UseRoomsResult {
  rooms: RoomSummary[];
  /** Sum of unread counts across the returned rooms. */
  totalUnread: number;
  acceptInvite: (roomId: string) => Promise<void>;
  declineInvite: (roomId: string) => Promise<void>;
}

/**
 * The chat list.
 *
 * Summaries are rebuilt when the session reports a room change, not on every
 * event: `roomSummary` fires for the affected room only. The rebuilt array is
 * cached so `useSyncExternalStore` sees a stable reference between changes,
 * which is what keeps a long list from re-rendering on unrelated traffic.
 */
export function useRooms(options: UseRoomsOptions = {}): UseRoomsResult {
  const { session } = useMatrixContext('useRooms');
  const cache = useRef<{ version: number; rooms: RoomSummary[] } | null>(null);
  const version = useRef(0);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const unsubscribers = [
        session.on('roomSummary', () => {
          version.current += 1;
          onChange();
        }),
        session.on('status', () => {
          version.current += 1;
          onChange();
        }),
      ];
      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      };
    },
    [session],
  );

  const getSnapshot = useCallback(() => {
    if (cache.current?.version === version.current) {
      return cache.current.rooms;
    }
    const client = session.getClient();
    const directRooms = directRoomUserIds(client);
    const rooms = sortRoomSummaries(
      session
        .getRooms()
        .map((room) => buildRoomSummary(room, { client, directRooms }))
        // A room the user has left stays in the SDK store until it is forgotten.
        .filter((summary) => summary.membership === 'join' || summary.membership === 'invite'),
    );
    cache.current = { version: version.current, rooms };
    return rooms;
  }, [session]);

  const allRooms = useSyncExternalStore(subscribe, getSnapshot);

  const rooms = useMemo(() => {
    let filtered = allRooms;
    if (options.hideInvites) {
      filtered = filtered.filter((room) => room.membership !== 'invite');
    }
    const search = options.search?.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter((room) => room.name.toLowerCase().includes(search));
    }
    return filtered;
  }, [allRooms, options.hideInvites, options.search]);

  const totalUnread = useMemo(
    () => rooms.reduce((total, room) => total + room.unreadCount, 0),
    [rooms],
  );

  const acceptInvite = useCallback(
    (roomId: string) => session.joinRoom(roomId),
    [session],
  );
  const declineInvite = useCallback(
    (roomId: string) => session.leaveRoom(roomId),
    [session],
  );

  return { rooms, totalUnread, acceptInvite, declineInvite };
}
