import { type ReactElement, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useMxcImage } from '../react/useMxcImage';
import { initials } from '../utils/format';
import { useMatrixUi } from './MatrixUiProvider';

export interface AvatarProps {
  /** `mxc://` URI. Null or unresolvable falls back to initials. */
  mxcUri?: string | null;
  /** Display name, used for the initials fallback and accessibility. */
  name: string;
  size?: number;
  testID?: string;
}

/**
 * A member or room avatar.
 *
 * Falls back to initials rather than a bundled placeholder image, so the
 * package ships no binary assets and the fallback inherits the theme.
 * Authenticated media means the image can also fail *after* a valid URL was
 * built — an expired token, a purged file — so the error path is the same one.
 */
export function Avatar({ mxcUri, name, size, testID }: AvatarProps): ReactElement {
  const { theme } = useMatrixUi();
  const edge = size ?? theme.avatarSize;
  const [failed, setFailed] = useState(false);

  // Request at twice the layout size so the thumbnail is sharp on a 2x screen
  // without downloading the original.
  const source = useMxcImage(mxcUri, {
    thumbnail: { width: edge * 2, height: edge * 2, method: 'crop' },
  });

  const frame = {
    width: edge,
    height: edge,
    borderRadius: edge / 2,
    backgroundColor: theme.colors.surface,
  };

  if (source && !failed) {
    return (
      <Image
        testID={testID}
        accessibilityLabel={name}
        source={source}
        style={[styles.image, frame]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View testID={testID} accessibilityLabel={name} style={[styles.fallback, frame]}>
      <Text
        style={[
          styles.initials,
          { color: theme.colors.textSecondary, fontSize: Math.round(edge * 0.4) },
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { resizeMode: 'cover' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '600' },
});
