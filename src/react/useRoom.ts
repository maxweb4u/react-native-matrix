import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import { buildMemberSummary, buildRoomSummary } from '../timeline/roomSummary';
import type { RoomMemberSummary, RoomSummary } from '../types';
import { useMatrixContext } from './context';

export interface UseRoomResult {
  /** Null until the room is present in the client store. */
  room: RoomSummary | null;
  members: RoomMemberSummary[];
  rename: (name: string) => Promise<void>;
  invite: (userIds: string[]) => Promise<void>;
  leave: () => Promise<void>;
}

/**
 * One room's metadata and membership.
 *
 * Returns null rather than throwing while the room is unknown: a screen opened
 * from a push notification can render before the room has synced.
 */
export function useRoom(roomId: string): UseRoomResult {
  const { session } = useMatrixContext('useRoom');
  const cache = useRef<{ version: number; summary: RoomSummary | null } | null>(null);
  const version = useRef(0);

  const subscribe = useCallback(
    (onChange: () => void) =>
      session.on('roomSummary', ({ roomId: changed }) => {
        if (changed === roomId) {
          version.current += 1;
          onChange();
        }
      }),
    [session, roomId],
  );

  const getSnapshot = useCallback(() => {
    if (cache.current?.version === version.current) {
      return cache.current.summary;
    }
    let summary: RoomSummary | null;
    try {
      summary = buildRoomSummary(session.getRoom(roomId), { client: session.getClient() });
    } catch {
      summary = null;
    }
    cache.current = { version: version.current, summary };
    return summary;
  }, [session, roomId]);

  const room = useSyncExternalStore(subscribe, getSnapshot);

  const members = useMemo(() => {
    if (!room) {
      return [];
    }
    const sdkRoom = session.getRoom(roomId);
    return sdkRoom
      .getMembers()
      .map((member) => buildMemberSummary(sdkRoom, member.userId))
      .filter((member): member is RoomMemberSummary => member !== null)
      .filter((member) => member.membership === 'join' || member.membership === 'invite');
    // `room` is the change signal: it is rebuilt whenever membership changes.
  }, [session, roomId, room]);

  const rename = useCallback(
    (name: string) => session.setRoomName(roomId, name),
    [session, roomId],
  );
  const invite = useCallback(
    (userIds: string[]) => session.invite(roomId, userIds),
    [session, roomId],
  );
  const leave = useCallback(() => session.leaveRoom(roomId), [session, roomId]);

  return { room, members, rename, invite, leave };
}
