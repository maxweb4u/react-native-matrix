import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatDayLabel, isToday, isYesterday } from '../utils/datetime';
import { useMatrixUi } from './MatrixUiProvider';

export interface DaySeparatorProps {
  /** Timestamp of the first message of the day, in milliseconds. */
  ts: number;
  testID?: string;
}

/**
 * The "Today" / "Yesterday" / date divider between days.
 *
 * The two relative labels come from `labels` rather than from
 * `formatDayLabel`, which stays a pure date formatter: they are words to
 * translate, and the rest of the components' strings are overridden in one
 * place. `Intl` handles the date itself.
 *
 * 0.0.x compared timestamps with a fixed millisecond span, so two messages
 * three hours apart across midnight got no separator while two messages
 * twenty hours apart on the same afternoon got one. `formatDayLabel` and
 * `isDifferentDay` compare calendar days instead.
 */
export function DaySeparator({ ts, testID }: DaySeparatorProps): ReactElement {
  const { theme, labels, locale } = useMatrixUi();

  let label: string;
  if (isToday(ts)) {
    label = labels.today;
  } else if (isYesterday(ts)) {
    label = labels.yesterday;
  } else {
    label = formatDayLabel(ts, locale);
  }

  return (
    <View testID={testID} style={[styles.row, { paddingVertical: theme.spacing.md }]}>
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.fontSize.caption,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'center' },
});
