import { useMemo } from 'react';

import { type MediaUrlOptions, mxcImageSource } from '../core/mxc';
import { useMatrixContext } from './context';

export interface MxcImageSource {
  uri: string;
  headers: Record<string, string>;
}

/**
 * Turns an `mxc://` URI into a source React Native's `<Image>` can render.
 *
 * Returns null when the URI is absent or unresolvable, so callers render their
 * own placeholder. The result carries the Authorization header alongside the
 * URL, because current homeservers serve media only to authenticated requests.
 *
 * See memory_bank/adr/ADR-004-authenticated-media-only.md.
 */
export function useMxcImage(
  mxcUri: string | null | undefined,
  options: MediaUrlOptions = {},
): MxcImageSource | null {
  const { session } = useMatrixContext('useMxcImage');
  const width = options.thumbnail?.width;
  const height = options.thumbnail?.height;
  const method = options.thumbnail?.method;

  return useMemo(
    () =>
      mxcImageSource(
        session.getClient(),
        mxcUri,
        width && height ? { thumbnail: { width, height, method } } : {},
      ),
    [session, mxcUri, width, height, method],
  );
}
