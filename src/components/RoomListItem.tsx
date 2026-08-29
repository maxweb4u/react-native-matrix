import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MessageKind } from '../types/content';
import type { RoomSummary } from '../types';
import { formatListTimestamp } from '../utils/datetime';
import { Avatar } from './Avatar';
import type { MatrixLabels } from './labels';
import { useMatrixUi } from './MatrixUiProvider';

export interface RoomListItemProps {
  room: RoomSummary;
  onPress?: (room: RoomSummary) => void;
  /** Rendered only for a pending invite. */
  onAccept?: (room: RoomSummary) => void;
  onDecline?: (room: RoomSummary) => void;
  testID?: string;
}

/** One row of the chat list. */
export function RoomListItem({
  room,
  onPress,
  onAccept,
  onDecline,
  testID,
}: RoomListItemProps): ReactElement {
  const { theme, labels, locale } = useMatrixUi();
  const isInvite = room.membership === 'invite';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={room.name}
      onPress={() => onPress?.(room)}
      disabled={onPress === undefined}
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.md,
        },
      ]}
    >
      <Avatar mxcUri={room.avatarMxcUri} name={room.name} size={theme.avatarSize + 8} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.colors.textPrimary,
              fontSize: theme.fontSize.title,
              fontWeight: '600',
            }}
          >
            {room.name}
          </Text>
          {room.lastActivityTs > 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.caption }}>
              {formatListTimestamp(room.lastActivityTs, locale)}
            </Text>
          ) : null}
        </View>

        <View style={[styles.previewRow, { gap: theme.spacing.sm }]}>
          <Text
            testID={testID ? `${testID}-preview` : undefined}
            numberOfLines={1}
            style={{ flex: 1, color: theme.colors.textSecondary, fontSize: theme.fontSize.small }}
          >
            {isInvite ? labels.invitation : previewOf(room, labels.ownMessagePrefix, labels)}
          </Text>

          {room.unreadCount > 0 ? (
            <View
              testID={testID ? `${testID}-unread` : undefined}
              style={[
                styles.badge,
                {
                  backgroundColor:
                    room.highlightCount > 0 ? theme.colors.danger : theme.colors.accent,
                  borderRadius: theme.radius.pill,
                  paddingHorizontal: theme.spacing.sm,
                },
              ]}
            >
              <Text style={{ color: theme.colors.textOnOwn, fontSize: theme.fontSize.caption }}>
                {room.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>

        {isInvite && (onAccept || onDecline) ? (
          <View style={[styles.inviteActions, { gap: theme.spacing.md }]}>
            {onAccept ? (
              <Pressable
                testID={testID ? `${testID}-accept` : undefined}
                accessibilityRole="button"
                accessibilityLabel={labels.acceptInvite}
                onPress={() => onAccept(room)}
              >
                <Text style={{ color: theme.colors.accent, fontSize: theme.fontSize.small }}>
                  {labels.acceptInvite}
                </Text>
              </Pressable>
            ) : null}
            {onDecline ? (
              <Pressable
                testID={testID ? `${testID}-decline` : undefined}
                accessibilityRole="button"
                accessibilityLabel={labels.declineInvite}
                onPress={() => onDecline(room)}
              >
                <Text style={{ color: theme.colors.danger, fontSize: theme.fontSize.small }}>
                  {labels.declineInvite}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Chat-list preview text: an attachment is named, not shown as an empty line. */
function previewOf(room: RoomSummary, ownPrefix: string, labels: MatrixLabels): string {
  const last = room.lastMessage;
  if (!last) {
    return labels.noMessagesYet;
  }

  const summary =
    last.kind === MessageKind.Image
      ? labels.image
      : last.kind === MessageKind.Video
        ? labels.video
        : last.kind === MessageKind.Audio
          ? labels.audio
          : last.kind === MessageKind.File
            ? labels.file
            : last.kind === MessageKind.Location
              ? labels.location
              : last.kind === MessageKind.Redacted
                ? labels.deletedMessage
                : last.body;

  return last.isOwn ? `${ownPrefix}${summary}` : summary;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { minWidth: 20, alignItems: 'center', justifyContent: 'center' },
  inviteActions: { flexDirection: 'row', alignItems: 'center' },
});
