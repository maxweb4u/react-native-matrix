/**
 * `mxc://` URI handling.
 *
 * 0.0.x built media URLs by hand and passed the access token as a custom
 * `accessToken` header that homeservers ignore, so downloads only worked while
 * the media repository allowed anonymous access. Authenticated media
 * (MSC3916) is on by default in current Synapse, which breaks that approach.
 *
 * Everything here therefore routes through `MatrixClient.mxcUrlToHttp` with
 * authentication enabled, and callers fetch with the Authorization header.
 *
 * See memory_bank/domain/media.md.
 */

import type { MatrixClient } from 'matrix-js-sdk';

export interface ParsedMxcUri {
  serverName: string;
  mediaId: string;
}

const MXC_PREFIX = 'mxc://';

/** Parses `mxc://server/mediaId`. Returns null for anything malformed. */
export function parseMxcUri(uri: string | null | undefined): ParsedMxcUri | null {
  if (typeof uri !== 'string' || !uri.startsWith(MXC_PREFIX)) {
    return null;
  }
  const rest = uri.slice(MXC_PREFIX.length);
  const separator = rest.indexOf('/');
  if (separator <= 0) {
    return null;
  }
  const serverName = rest.slice(0, separator);
  const mediaId = rest.slice(separator + 1);
  if (!serverName || !mediaId || mediaId.includes('/')) {
    return null;
  }
  return { serverName, mediaId };
}

export function isMxcUri(uri: string | null | undefined): boolean {
  return parseMxcUri(uri) !== null;
}

export interface MediaUrlOptions {
  /** Requests a scaled thumbnail instead of the original file. */
  thumbnail?: {
    width: number;
    height: number;
    /** `crop` fills the box, `scale` fits inside it. Defaults to `crop`. */
    method?: 'crop' | 'scale';
  };
}

/**
 * Resolves an `mxc://` URI to an HTTP URL on the homeserver.
 *
 * The URL points at the authenticated media endpoint, so it is only usable
 * together with the access token — see {@link mediaFetchHeaders}. Returns null
 * when the URI is malformed or the server has no media repository configured.
 */
export function mxcToHttpUrl(
  client: MatrixClient,
  mxcUri: string | null | undefined,
  options: MediaUrlOptions = {},
): string | null {
  if (!parseMxcUri(mxcUri)) {
    return null;
  }
  const { thumbnail } = options;
  return client.mxcUrlToHttp(
    mxcUri as string,
    thumbnail?.width,
    thumbnail?.height,
    // The SDK switches to the thumbnail endpoint as soon as any of width,
    // height or method is set. Defaulting the method here therefore turned
    // every download — including the original of a file attachment — into a
    // cropped thumbnail request.
    thumbnail ? (thumbnail.method ?? 'crop') : undefined,
    // allowDirectLinks: never hand out URLs that bypass the homeserver.
    false,
    // allowRedirects: required by the authenticated media endpoint.
    true,
    // useAuthentication
    true,
  );
}

/**
 * Headers required to fetch a URL returned by {@link mxcToHttpUrl}.
 *
 * React Native's `<Image>` accepts these through `source={{ uri, headers }}`.
 */
export function mediaFetchHeaders(client: MatrixClient): Record<string, string> {
  const token = client.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * A React Native image source for an `mxc://` URI, or null when unresolvable.
 *
 * Callers fall back to their own placeholder when this returns null.
 */
export function mxcImageSource(
  client: MatrixClient,
  mxcUri: string | null | undefined,
  options: MediaUrlOptions = {},
): { uri: string; headers: Record<string, string> } | null {
  const uri = mxcToHttpUrl(client, mxcUri, options);
  if (!uri) {
    return null;
  }
  return { uri, headers: mediaFetchHeaders(client) };
}
