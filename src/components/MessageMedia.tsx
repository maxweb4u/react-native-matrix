import { type ReactElement, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMxcImage } from '../react/useMxcImage';
import { MessageKind, type MediaInfo } from '../types/content';
import { formatBytes, truncateFileName } from '../utils/format';
import { formatDuration } from '../utils/datetime';
import { useMatrixUi } from './MatrixUiProvider';

/** Widest an inline image is drawn, before the bubble padding. */
const MAX_IMAGE_WIDTH = 240;
const MAX_IMAGE_HEIGHT = 320;

export interface MessageMediaProps {
  kind: MessageKind;
  media: MediaInfo;
  /** Message body, which for an attachment is the original file name. */
  fileName: string;
  isOwn: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * The attachment part of a message.
 *
 * Images and videos are drawn from the thumbnail endpoint rather than the
 * original: a photo from a modern phone camera is several megabytes, and a
 * conversation renders dozens of them. Anything that is not previewable is a
 * labelled row, so a file always has an obvious affordance even when the host
 * supplies no viewer.
 */
export function MessageMedia({
  kind,
  media,
  fileName,
  isOwn,
  onPress,
  testID,
}: MessageMediaProps): ReactElement {
  const { theme, labels } = useMatrixUi();
  const [failed, setFailed] = useState(false);

  const previewUri = kind === MessageKind.Video ? media.thumbnailMxcUri : media.mxcUri;
  const source = useMxcImage(previewUri, {
    thumbnail: { width: MAX_IMAGE_WIDTH * 2, height: MAX_IMAGE_HEIGHT * 2, method: 'scale' },
  });

  const isPreviewable = kind === MessageKind.Image || kind === MessageKind.Video;
  const textColor = isOwn ? theme.colors.textOnOwn : theme.colors.textPrimary;

  if (isPreviewable && source && !failed) {
    // Preserve the sender's aspect ratio when it is advertised; a square box
    // otherwise, which is better than a zero-height view that never appears.
    const ratio = media.width && media.height ? media.width / media.height : 1;
    const width = MAX_IMAGE_WIDTH;
    const height = Math.min(Math.round(width / (ratio || 1)), MAX_IMAGE_HEIGHT);

    return (
      <Pressable
        testID={testID}
        accessibilityRole="image"
        accessibilityLabel={kind === MessageKind.Video ? labels.video : labels.image}
        disabled={onPress === undefined}
        onPress={onPress}
      >
        <Image
          source={source}
          onError={() => setFailed(true)}
          style={[styles.preview, { width, height, borderRadius: theme.radius.bubble / 2 }]}
        />
        {kind === MessageKind.Video && media.durationMs !== null ? (
          <View style={[styles.durationBadge, { borderRadius: theme.radius.pill }]}>
            <Text style={[styles.durationText, { fontSize: theme.fontSize.caption }]}>
              {formatDuration(media.durationMs)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  const description =
    kind === MessageKind.Audio && media.durationMs !== null
      ? formatDuration(media.durationMs)
      : formatBytes(media.size);

  const title =
    kind === MessageKind.Audio ? labels.audio : truncateFileName(fileName || labels.file);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[styles.fileRow, { gap: theme.spacing.sm }]}
    >
      <Text style={{ color: textColor, fontSize: theme.fontSize.body }} numberOfLines={1}>
        {title}
      </Text>
      <Text style={{ color: textColor, fontSize: theme.fontSize.caption, opacity: 0.7 }}>
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: { resizeMode: 'cover' },
  fileRow: { flexDirection: 'row', alignItems: 'center' },
  durationBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  durationText: { color: '#ffffff' },
});
