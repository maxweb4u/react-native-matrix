import { type ReactElement, useCallback } from 'react';
import { FlatList, type ListRenderItemInfo, StyleSheet, Text, View } from 'react-native';

import { useRooms, type UseRoomsOptions } from '../react/useRooms';
import type { RoomSummary } from '../types';
import { RoomListItem } from './RoomListItem';
import { useMatrixUi } from './MatrixUiProvider';

export interface RoomListProps extends UseRoomsOptions {
  onSelectRoom?: (room: RoomSummary) => void;
  /**
   * Accepting an invite is offered inline by default. Pass false when the host
   * wants its own confirmation flow.
   */
  allowInviteActions?: boolean;
  testID?: string;
}

/**
 * The chat list.
 *
 * Ordering and invite pinning come from `sortRoomSummaries`, not from this
 * component: 0.0.x sorted with a comparator that returned a boolean, so the
 * list order was effectively arbitrary and changed on every render.
 */
export function RoomList({
  onSelectRoom,
  allowInviteActions = true,
  testID,
  ...options
}: RoomListProps): ReactElement {
  const { theme, labels } = useMatrixUi();
  const { rooms, acceptInvite, declineInvite } = useRooms(options);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RoomSummary>) => (
      <RoomListItem
        testID={testID ? `${testID}-item-${item.id}` : undefined}
        room={item}
        onPress={onSelectRoom}
        onAccept={
          allowInviteActions ? (room) => void acceptInvite(room.id).catch(() => {}) : undefined
        }
        onDecline={
          allowInviteActions ? (room) => void declineInvite(room.id).catch(() => {}) : undefined
        }
      />
    ),
    [testID, onSelectRoom, allowInviteActions, acceptInvite, declineInvite],
  );

  if (rooms.length === 0) {
    return (
      <View testID={testID} style={[styles.empty, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.body }}>
          {labels.emptyRoomList}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      testID={testID}
      data={rooms}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      style={{ backgroundColor: theme.colors.background }}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
      )}
    />
  );
}

const keyExtractor = (room: RoomSummary): string => room.id;

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
});
