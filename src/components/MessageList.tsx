import { type ReactElement, useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, type ListRenderItemInfo, StyleSheet, Text, View } from 'react-native';

import { useTimeline } from '../react/useTimeline';
import type { TimelineItem } from '../types';
import { isDifferentDay } from '../utils/datetime';
import { DaySeparator } from './DaySeparator';
import { MessageRow } from './MessageRow';
import { useMatrixUi } from './MatrixUiProvider';

export interface MessageListProps {
  roomId: string;
  onPressMessage?: (item: TimelineItem) => void;
  onLongPressMessage?: (item: TimelineItem) => void;
  onPressMedia?: (item: TimelineItem) => void;
  /**
   * Sends a read receipt for the newest message as it arrives. Disable when
   * the host controls read state itself, e.g. only while the screen is focused.
   */
  autoMarkRead?: boolean;
  testID?: string;
}

/**
 * The conversation.
 *
 * Inverted, because a chat is read from the bottom: the newest message must be
 * on screen without a scroll-to-end after every render, and loading history is
 * then just `onEndReached`. `TimelineStore` already keeps the newest-first
 * order this needs, so nothing is reversed at render time.
 */
export function MessageList({
  roomId,
  onPressMessage,
  onLongPressMessage,
  onPressMedia,
  autoMarkRead = true,
  testID,
}: MessageListProps): ReactElement {
  const { theme, labels } = useMatrixUi();
  const { items, isLoading, hasMore, isPaginating, loadMore, toggleReaction, markRead, retry } =
    useTimeline(roomId);

  const newestId = items[0]?.id;
  const newestIsOwn = items[0]?.isOwn ?? false;

  useEffect(() => {
    // Never receipt an own message: the homeserver rejects it and it would
    // fire on every send.
    if (!autoMarkRead || !newestId || newestIsOwn) {
      return;
    }
    // A failed receipt is cosmetic and must not reject into the render path.
    void markRead(newestId).catch(() => {});
  }, [autoMarkRead, newestId, newestIsOwn, markRead]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TimelineItem>) => {
      // Newest first, so the *older* neighbour is the next index.
      const older = items[index + 1];
      const startsDay = !older || isDifferentDay(item.ts, older.ts);
      const startsGroup = startsDay || !older || older.sender !== item.sender;

      return (
        <View>
          {startsDay ? <DaySeparator ts={item.ts} /> : null}
          <MessageRow
            testID={testID ? `${testID}-item-${item.id}` : undefined}
            item={item}
            showSender={startsGroup}
            onPress={onPressMessage}
            onLongPress={onLongPressMessage}
            onPressMedia={onPressMedia}
            onPressReaction={(target, key) => void toggleReaction(target.id, key).catch(() => {})}
            onRetry={(target) => void retry(target).catch(() => {})}
          />
        </View>
      );
    },
    [items, onPressMessage, onLongPressMessage, onPressMedia, toggleReaction, retry, testID],
  );

  const onEndReached = useCallback(() => {
    if (hasMore && !isPaginating) {
      // Concurrent calls collapse inside RoomTimeline, so a fast scroll cannot
      // issue a request per frame.
      void loadMore().catch(() => {});
    }
  }, [hasMore, isPaginating, loadMore]);

  if (isLoading && items.length === 0) {
    return (
      <View testID={testID} style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.small }}>
          {labels.loadingConversation}
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View testID={testID} style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.body }}>
          {labels.emptyConversation}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID={testID}
      inverted
      data={items as TimelineItem[]}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingVertical: theme.spacing.sm }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      ListFooterComponent={
        isPaginating ? (
          <View style={styles.footer}>
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        ) : undefined
      }
    />
  );
}

const keyExtractor = (item: TimelineItem): string => item.id;

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  footer: { paddingVertical: 12 },
});
