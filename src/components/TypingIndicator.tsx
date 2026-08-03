import type { ReactElement } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useRoom } from '../react/useRoom';
import { useTyping } from '../react/useTyping';
import { useMatrixUi } from './MatrixUiProvider';

export interface TypingIndicatorProps {
  roomId: string;
  testID?: string;
}

/**
 * "Alice is typing…".
 *
 * Renders nothing when nobody is typing rather than an empty reserved row, so
 * the conversation does not shift by a line every few seconds.
 */
export function TypingIndicator({ roomId, testID }: TypingIndicatorProps): ReactElement | null {
  const { theme, labels } = useMatrixUi();
  const { typingUserIds } = useTyping(roomId);
  const { members } = useRoom(roomId);

  if (typingUserIds.length === 0) {
    return null;
  }

  const nameOf = (userId: string): string =>
    members.find((member) => member.userId === userId)?.displayName ?? userId;

  const text =
    typingUserIds.length === 1
      ? labels.typingOne(nameOf(typingUserIds[0] as string))
      : typingUserIds.length === 2
        ? labels.typingTwo(nameOf(typingUserIds[0] as string), nameOf(typingUserIds[1] as string))
        : labels.typingMany(typingUserIds.length);

  return (
    <Text
      testID={testID}
      numberOfLines={1}
      style={[
        styles.text,
        {
          color: theme.colors.textSecondary,
          fontSize: theme.fontSize.caption,
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.xs,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontStyle: 'italic' },
});
