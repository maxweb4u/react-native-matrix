import { useCallback, useEffect, useRef, useState } from 'react';

import { useMatrixContext } from './context';

const EMPTY: readonly string[] = [];

export interface UseTypingResult {
  /** User IDs currently typing, excluding the local user. */
  typingUserIds: readonly string[];
  /**
   * Reports that the local user is composing. Safe to call on every keystroke:
   * calls are throttled and a stop is scheduled automatically.
   */
  setTyping: (isTyping: boolean) => void;
}

/** How long the homeserver should consider the user typing. */
const TYPING_TIMEOUT_MS = 4_000;
/** Minimum gap between outgoing typing notifications. */
const THROTTLE_MS = 2_000;

/**
 * Typing indicators for one room.
 *
 * Outgoing notifications are throttled because a naive implementation sends a
 * request per keystroke. The scheduled stop matters just as much: without it a
 * user who stops mid-sentence appears to type forever.
 */
export function useTyping(roomId: string): UseTypingResult {
  const { session } = useMatrixContext('useTyping');
  const [typingUserIds, setTypingUserIds] = useState<readonly string[]>(EMPTY);

  const lastSentAt = useRef(0);
  const isTypingNow = useRef(false);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = session.on('typing', ({ roomId: changed, userIds }) => {
      if (changed === roomId) {
        setTypingUserIds(userIds.length > 0 ? userIds : EMPTY);
      }
    });
    return () => {
      unsubscribe();
      setTypingUserIds(EMPTY);
    };
  }, [session, roomId]);

  const send = useCallback(
    (isTyping: boolean) => {
      isTypingNow.current = isTyping;
      lastSentAt.current = Date.now();
      // Failures here are cosmetic; they must not reject into the caller's
      // keystroke handler.
      void session.sendTyping(roomId, isTyping, TYPING_TIMEOUT_MS).catch(() => {});
    },
    [session, roomId],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
        stopTimer.current = null;
      }

      if (!isTyping) {
        if (isTypingNow.current) {
          send(false);
        }
        return;
      }

      const elapsed = Date.now() - lastSentAt.current;
      if (!isTypingNow.current || elapsed >= THROTTLE_MS) {
        send(true);
      }
      stopTimer.current = setTimeout(() => send(false), TYPING_TIMEOUT_MS);
    },
    [send],
  );

  useEffect(
    () => () => {
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
      }
      if (isTypingNow.current) {
        void session.sendTyping(roomId, false, TYPING_TIMEOUT_MS).catch(() => {});
      }
    },
    [session, roomId],
  );

  return { typingUserIds, setTyping };
}
