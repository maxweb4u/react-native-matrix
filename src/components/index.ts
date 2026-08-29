/**
 * Default UI, built on React Native primitives only.
 *
 * Use the whole `ChatScreen`, or compose `MessageList` and `Composer`
 * yourself, or ignore this layer entirely and render from the hooks. Each
 * option is supported; see memory_bank/product/vision.md.
 */

export { Avatar, type AvatarProps } from './Avatar';
export { ChatScreen, type ChatScreenProps } from './ChatScreen';
export { Composer, type ComposerProps } from './Composer';
export { DaySeparator, type DaySeparatorProps } from './DaySeparator';
export { defaultLabels, type MatrixLabels } from './labels';
export { MatrixUiProvider, type MatrixUiProviderProps, type MatrixUi, useMatrixUi } from './MatrixUiProvider';
export { MessageList, type MessageListProps } from './MessageList';
export { MessageMedia, type MessageMediaProps } from './MessageMedia';
export { MessageRow, type MessageRowProps } from './MessageRow';
export { ReactionBar, type ReactionBarProps } from './ReactionBar';
export { RoomList, type RoomListProps } from './RoomList';
export { RoomListItem, type RoomListItemProps } from './RoomListItem';
export { defaultTheme, type MatrixTheme, type MatrixThemeOverride, mergeTheme } from './theme';
export { TypingIndicator, type TypingIndicatorProps } from './TypingIndicator';
