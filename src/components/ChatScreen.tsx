import { type ReactElement, useCallback, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import type { TimelineItem } from '../types';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import { useMatrixUi } from './MatrixUiProvider';

export interface ChatScreenProps {
  roomId: string;
  /**
   * Distance from the top of the screen to the top of this view, usually the
   * height of a navigation header. Without it the composer sits under the
   * keyboard on iOS by exactly that amount.
   */
  keyboardVerticalOffset?: number;
  /** Long-pressing a message starts a reply by default. */
  onLongPressMessage?: (item: TimelineItem) => void;
  onPressMedia?: (item: TimelineItem) => void;
  autoMarkRead?: boolean;
  testID?: string;
}

/**
 * A complete conversation screen: history, typing indicator, and composer.
 *
 * Keyboard handling is the reason this exists as a component rather than as a
 * snippet in the README. 0.0.x subscribed only to `keyboardWillShow`, which
 * never fires on Android, so the composer stayed under the keyboard there for
 * the life of the package.
 *
 * `padding` is used on both platforms. Android relied on the window's
 * `adjustResize` until React Native 0.87 turned edge-to-edge on by default:
 * an edge-to-edge window is not resized for the keyboard, so `adjustResize`
 * alone leaves the composer behind it again. With the window resized (older
 * React Native, or `edgeToEdgeEnabled=false`) the measured keyboard height
 * collapses to zero and the padding costs nothing, so one behaviour is
 * correct in both modes.
 *
 * `android:windowSoftInputMode="adjustResize"` in the host manifest is still
 * wanted for the non-edge-to-edge case; see memory_bank/ops/development.md.
 */
export function ChatScreen({
  roomId,
  keyboardVerticalOffset = 0,
  onLongPressMessage,
  onPressMedia,
  autoMarkRead,
  testID,
}: ChatScreenProps): ReactElement {
  const { theme } = useMatrixUi();
  const [replyTo, setReplyTo] = useState<TimelineItem | null>(null);

  const handleLongPress = useCallback(
    (item: TimelineItem) => {
      if (onLongPressMessage) {
        onLongPressMessage(item);
        return;
      }
      if (!item.isRedacted) {
        setReplyTo(item);
      }
    },
    [onLongPressMessage],
  );

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={styles.list}>
        <MessageList
          testID={testID ? `${testID}-list` : undefined}
          roomId={roomId}
          autoMarkRead={autoMarkRead}
          onLongPressMessage={handleLongPress}
          onPressMedia={onPressMedia}
        />
      </View>

      <TypingIndicator testID={testID ? `${testID}-typing` : undefined} roomId={roomId} />

      <Composer
        testID={testID ? `${testID}-composer` : undefined}
        roomId={roomId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
});
