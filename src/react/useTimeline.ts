import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { LocalFile, TimelineItem } from '../types';
import { useMatrixContext } from './context';

export interface SendOptions {
  /** Sends as a reply to this event. */
  replyToEventId?: string;
  /** Sends into a thread rooted at this event. */
  threadRootId?: string;
}

export interface UseTimelineResult {
  /** Newest first, ready for an inverted list. */
  items: readonly TimelineItem[];
  /** True while the initial window is still being assembled. */
  isLoading: boolean;
  /** False once the start of the room has been reached. */
  hasMore: boolean;
  isPaginating: boolean;
  /** Loads the next page of older messages. Concurrent calls collapse into one. */
  loadMore: () => Promise<void>;

  sendText: (body: string, options?: SendOptions) => Promise<void>;
  sendFile: (file: LocalFile, options?: SendOptions) => Promise<void>;
  editText: (eventId: string, newBody: string) => Promise<void>;
  deleteMessage: (eventId: string, reason?: string) => Promise<void>;
  toggleReaction: (eventId: string, key: string) => Promise<void>;
  markRead: (eventId: string) => Promise<void>;
  /** Retries a message whose `sendState` is `failed`. */
  retry: (item: TimelineItem) => Promise<void>;

  /** Set when an action failed; cleared on the next successful action. */
  error: Error | null;
}

/**
 * The conversation in one room, plus the actions that change it.
 *
 * The underlying `RoomTimeline` is shared through the provider and reference
 * counted, so several screens showing the same room cost one subscription.
 *
 * See memory_bank/domain/timeline.md.
 */
export function useTimeline(roomId: string): UseTimelineResult {
  const { session, acquireTimeline, releaseTimeline } = useMatrixContext('useTimeline');
  const [error, setError] = useState<Error | null>(null);

  const timeline = useMemo(() => acquireTimeline(roomId), [acquireTimeline, roomId]);

  useEffect(() => () => releaseTimeline(roomId), [releaseTimeline, roomId, timeline]);

  const subscribe = useCallback(
    (onChange: () => void) => timeline.subscribe(onChange),
    [timeline],
  );
  const items = useSyncExternalStore(subscribe, () => timeline.getSnapshot());

  // Pagination flags live on the controller and are read through the same
  // subscription. The snapshot object is cached: `useSyncExternalStore`
  // compares snapshots by identity, so returning a fresh object literal on
  // every call would re-render without end.
  const paginationRef = useRef({ hasMore: timeline.hasMore, isPaginating: timeline.isPaginating });
  const getPagination = useCallback(() => {
    const cached = paginationRef.current;
    if (cached.hasMore !== timeline.hasMore || cached.isPaginating !== timeline.isPaginating) {
      paginationRef.current = { hasMore: timeline.hasMore, isPaginating: timeline.isPaginating };
    }
    return paginationRef.current;
  }, [timeline]);
  const pagination = useSyncExternalStore(subscribe, getPagination);

  const statusSubscribe = useCallback(
    (onChange: () => void) => session.on('status', onChange),
    [session],
  );
  const status = useSyncExternalStore(statusSubscribe, () => session.getStatus());

  /** Wraps an action so a failure surfaces in `error` instead of unhandled. */
  const run = useCallback(async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
      setError(null);
    } catch (caught) {
      const normalized = caught instanceof Error ? caught : new Error(String(caught));
      setError(normalized);
      throw normalized;
    }
  }, []);

  const loadMore = useCallback(
    () => run(() => timeline.paginateBack()),
    [run, timeline],
  );

  const sendText = useCallback(
    (body: string, options?: SendOptions) => {
      const trimmed = body.trim();
      if (!trimmed) {
        return Promise.resolve();
      }
      return run(() => session.sendText(roomId, trimmed, options ?? {}));
    },
    [run, session, roomId],
  );

  const sendFile = useCallback(
    (file: LocalFile, options?: SendOptions) =>
      run(() => session.sendFile(roomId, file, options ?? {})),
    [run, session, roomId],
  );

  const editText = useCallback(
    (eventId: string, newBody: string) => run(() => session.editText(roomId, eventId, newBody)),
    [run, session, roomId],
  );

  const deleteMessage = useCallback(
    (eventId: string, reason?: string) => run(() => session.redact(roomId, eventId, reason)),
    [run, session, roomId],
  );

  /**
   * Adds the reaction, or removes it when the user already reacted with that
   * key. 0.0.x could only ever add, and only one hard-coded key.
   */
  const toggleReaction = useCallback(
    (eventId: string, key: string) =>
      run(() => {
        const item = items.find((candidate) => candidate.id === eventId);
        const existing = item?.reactions.find((reaction) => reaction.key === key);
        if (existing?.reactedByMe && existing.myReactionEventId) {
          return session.unreact(roomId, existing.myReactionEventId);
        }
        return session.react(roomId, eventId, key);
      }),
    [run, session, roomId, items],
  );

  const markRead = useCallback(
    (eventId: string) => run(() => session.markRead(roomId, eventId)),
    [run, session, roomId],
  );

  const retry = useCallback(
    (item: TimelineItem) =>
      run(() => {
        if (item.sendState !== 'failed') {
          return Promise.resolve();
        }
        // The SDK resends the original event, so an attachment is not
        // re-uploaded and the transaction ID is reused: no duplicate message.
        return session.retrySend(roomId, item.id);
      }),
    [run, session, roomId],
  );

  return {
    items,
    // The window is usable as soon as the first sync lands; until then the
    // room may legitimately be empty rather than merely unloaded.
    isLoading: !status.isReady,
    hasMore: pagination.hasMore,
    isPaginating: pagination.isPaginating,
    loadMore,
    sendText,
    sendFile,
    editText,
    deleteMessage,
    toggleReaction,
    markRead,
    retry,
    error,
  };
}
