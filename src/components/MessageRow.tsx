import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MessageKind } from '../types/content';
import type { TimelineItem } from '../types';
import { formatMessageTime } from '../utils/datetime';
import { Avatar } from './Avatar';
import { MessageMedia } from './MessageMedia';
import { ReactionBar } from './ReactionBar';
import { useMatrixUi } from './MatrixUiProvider';

export interface MessageRowProps {
  item: TimelineItem;
  /**
   * Draws the avatar and sender name. Pass false for a message grouped under
   * the previous one from the same sender.
   */
  showSender?: boolean;
  onPress?: (item: TimelineItem) => void;
  onLongPress?: (item: TimelineItem) => void;
  onPressReaction?: (item: TimelineItem, key: string) => void;
  onPressMedia?: (item: TimelineItem) => void;
  /** Offered only when `sendState` is `failed`. */
  onRetry?: (item: TimelineItem) => void;
  testID?: string;
}

/** Kinds whose body is a file name rather than something to read. */
const MEDIA_KINDS = new Set<MessageKind>([
  MessageKind.Image,
  MessageKind.Video,
  MessageKind.Audio,
  MessageKind.File,
]);

/**
 * One message.
 *
 * Every state a message can be in is rendered as something: a redaction and a
 * failed decryption become explicit placeholders rather than an empty bubble,
 * and an unsupported msgtype says so instead of rendering nothing. A row that
 * silently draws nothing is indistinguishable from a bug.
 */
export function MessageRow({
  item,
  showSender = true,
  onPress,
  onLongPress,
  onPressReaction,
  onPressMedia,
  onRetry,
  testID,
}: MessageRowProps): ReactElement {
  const { theme, labels, locale } = useMatrixUi();

  const isOwn = item.isOwn;
  const textColor = isOwn ? theme.colors.textOnOwn : theme.colors.textPrimary;
  const mutedColor = isOwn ? theme.colors.textOnOwn : theme.colors.textSecondary;

  const bubbleStyle = {
    backgroundColor: isOwn ? theme.colors.bubbleOwn : theme.colors.bubbleOther,
    borderRadius: theme.radius.bubble,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  };

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        {
          justifyContent: isOwn ? 'flex-end' : 'flex-start',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs / 2,
          gap: theme.spacing.sm,
        },
      ]}
    >
      {!isOwn ? (
        showSender ? (
          <Avatar mxcUri={item.senderAvatarMxcUri} name={item.senderDisplayName} />
        ) : (
          // Keeps grouped messages aligned with the first one of the group.
          <View style={{ width: theme.avatarSize }} />
        )
      ) : null}

      <View style={styles.column}>
        {!isOwn && showSender ? (
          <Text
            testID={testID ? `${testID}-sender` : undefined}
            style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.caption }}
          >
            {item.senderDisplayName}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={onPress === undefined && onLongPress === undefined}
          onPress={() => onPress?.(item)}
          onLongPress={() => onLongPress?.(item)}
          style={bubbleStyle}
        >
          {item.replyTo ? (
            <View
              testID={testID ? `${testID}-reply` : undefined}
              style={[
                styles.quote,
                { borderLeftColor: mutedColor, paddingLeft: theme.spacing.sm },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{ color: mutedColor, fontSize: theme.fontSize.caption }}
              >
                {item.replyTo.senderDisplayName ?? item.replyTo.sender ?? ''}
              </Text>
              <Text
                numberOfLines={2}
                style={{ color: mutedColor, fontSize: theme.fontSize.small }}
              >
                {item.replyTo.body ?? ''}
              </Text>
            </View>
          ) : null}

          <MessageBody item={item} textColor={textColor} onPressMedia={onPressMedia} />

          <View style={[styles.meta, { gap: theme.spacing.xs }]}>
            {item.isEdited ? (
              <Text
                testID={testID ? `${testID}-edited` : undefined}
                style={{ color: mutedColor, fontSize: theme.fontSize.caption }}
              >
                {labels.edited}
              </Text>
            ) : null}
            <Text style={{ color: mutedColor, fontSize: theme.fontSize.caption }}>
              {formatMessageTime(item.ts, locale)}
            </Text>
            {item.sendState === 'sending' ? (
              <Text style={{ color: mutedColor, fontSize: theme.fontSize.caption }}>
                {labels.sending}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {item.sendState === 'failed' ? (
          <Pressable
            testID={testID ? `${testID}-retry` : undefined}
            accessibilityRole="button"
            accessibilityLabel={labels.retry}
            disabled={onRetry === undefined}
            onPress={() => onRetry?.(item)}
            style={[styles.failed, { gap: theme.spacing.xs }]}
          >
            <Text style={{ color: theme.colors.danger, fontSize: theme.fontSize.caption }}>
              {item.sendError ?? labels.sendFailed}
            </Text>
            <Text
              style={{
                color: theme.colors.accent,
                fontSize: theme.fontSize.caption,
                fontWeight: '600',
              }}
            >
              {labels.retry}
            </Text>
          </Pressable>
        ) : null}

        <ReactionBar
          testID={testID ? `${testID}-reactions` : undefined}
          reactions={item.reactions}
          onPressReaction={
            onPressReaction ? (key: string) => onPressReaction(item, key) : undefined
          }
        />
      </View>
    </View>
  );
}

interface MessageBodyProps {
  item: TimelineItem;
  textColor: string;
  onPressMedia?: (item: TimelineItem) => void;
}

/** The content of the bubble, chosen by kind. */
function MessageBody({ item, textColor, onPressMedia }: MessageBodyProps): ReactElement {
  const { theme, labels } = useMatrixUi();

  const placeholder = (text: string): ReactElement => (
    <Text
      style={{
        color: textColor,
        fontSize: theme.fontSize.body,
        fontStyle: 'italic',
        opacity: 0.75,
      }}
    >
      {text}
    </Text>
  );

  if (item.isRedacted || item.kind === MessageKind.Redacted) {
    return placeholder(labels.deletedMessage);
  }

  if (item.kind === MessageKind.UndecryptableEncrypted) {
    return placeholder(labels.undecryptableMessage);
  }

  if (item.kind === MessageKind.Location) {
    const position = item.location;
    return (
      <Text style={{ color: textColor, fontSize: theme.fontSize.body }}>
        {position
          ? `${labels.location}: ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
          : labels.location}
      </Text>
    );
  }

  if (MEDIA_KINDS.has(item.kind) && item.media) {
    return (
      <MessageMedia
        kind={item.kind}
        media={item.media}
        fileName={item.body}
        isOwn={item.isOwn}
        onPress={onPressMedia ? () => onPressMedia(item) : undefined}
      />
    );
  }

  if (item.kind === MessageKind.Unsupported) {
    return placeholder(labels.unsupportedMessage);
  }

  const body =
    item.kind === MessageKind.Emote ? `${item.senderDisplayName} ${item.body}` : item.body;

  return (
    <Text
      style={{
        color: textColor,
        fontSize: theme.fontSize.body,
        fontStyle: item.kind === MessageKind.Emote ? 'italic' : 'normal',
        opacity: item.kind === MessageKind.Notice ? 0.8 : 1,
      }}
    >
      {body}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  column: { maxWidth: '78%', alignItems: 'flex-start' },
  quote: { borderLeftWidth: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
  failed: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
});
