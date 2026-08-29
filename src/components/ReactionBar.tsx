import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReactionSummary } from '../types';
import { useMatrixUi } from './MatrixUiProvider';

export interface ReactionBarProps {
  reactions: readonly ReactionSummary[];
  /** Called with the reaction key. Adding and removing use the same call. */
  onPressReaction?: (key: string) => void;
  testID?: string;
}

/**
 * The reaction chips under a message.
 *
 * A chip the local user is part of is highlighted and toggles off when pressed,
 * which is the whole interaction: 0.0.x could only ever add, only ever the one
 * hard-coded `liked` key, and stored the result in component state so it was
 * lost on re-render.
 */
export function ReactionBar({
  reactions,
  onPressReaction,
  testID,
}: ReactionBarProps): ReactElement | null {
  const { theme, labels } = useMatrixUi();

  if (reactions.length === 0) {
    return null;
  }

  return (
    <View testID={testID} style={[styles.row, { gap: theme.spacing.xs }]}>
      {reactions.map((reaction) => (
        <Pressable
          key={reaction.key}
          testID={testID ? `${testID}-${reaction.key}` : undefined}
          accessibilityRole="button"
          accessibilityLabel={labels.reactionAccessibility(reaction.key, reaction.count)}
          accessibilityState={{ selected: reaction.reactedByMe }}
          disabled={onPressReaction === undefined}
          onPress={() => onPressReaction?.(reaction.key)}
          style={[
            styles.chip,
            {
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs / 2,
              backgroundColor: reaction.reactedByMe ? theme.colors.accent : theme.colors.surface,
              borderColor: reaction.reactedByMe ? theme.colors.accent : theme.colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: theme.fontSize.small,
              color: reaction.reactedByMe ? theme.colors.textOnOwn : theme.colors.textPrimary,
            }}
          >
            {reaction.key} {reaction.count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: StyleSheet.hairlineWidth },
});
