/**
 * Translation between this library's `PusherOptions` and the wire format.
 *
 * Kept apart from the session so the mapping can be tested without a client:
 * every field here is one a homeserver accepts silently when wrong, so the
 * only protection is an assertion on the exact object that goes out.
 */

import type { Pusher, PusherOptions } from '../types/push';

/**
 * Identifiers only, no message content. The homeserver sends the room and
 * event ID and the push gateway never sees a message body — which is also what
 * makes `resolvePushEvent` necessary, since the host has nothing to display
 * until it fetches the event.
 */
export const DEFAULT_PUSH_FORMAT = 'event_id_only';

const HTTP_KIND = 'http';

export interface PusherRequest {
  app_id: string;
  pushkey: string;
  kind: string | null;
  app_display_name: string;
  device_display_name: string;
  lang: string;
  data: { url: string; format: string; brand?: string };
  append: boolean;
}

/** Builds the `POST /pushers/set` body. */
export function buildPusherRequest(options: PusherOptions, pushkey: string): PusherRequest {
  return {
    app_id: options.appId,
    pushkey,
    kind: HTTP_KIND,
    app_display_name: options.appDisplayName,
    device_display_name: options.deviceDisplayName,
    lang: options.lang ?? 'en',
    data: {
      url: options.gatewayUrl,
      format: options.format ?? DEFAULT_PUSH_FORMAT,
      ...(options.brand ? { brand: options.brand } : {}),
    },
    // False by default, but this is narrower than it looks: the specification
    // has it remove pushers with the same app ID *and pushkey* registered by
    // other users. It does not clean up this user's previous token, which
    // `MatrixSession.registerPusher` deletes explicitly.
    append: options.append ?? false,
  };
}

/**
 * Builds the body that deletes a pusher.
 *
 * Deletion is the same endpoint with `kind: null`, not a DELETE — an easy
 * thing to get wrong, and getting it wrong on sign-out leaves the device
 * receiving pushes for an account it is no longer signed into.
 */
export function buildPusherRemoval(appId: string, pushkey: string): PusherRequest {
  return {
    app_id: appId,
    pushkey,
    kind: null,
    app_display_name: '',
    device_display_name: '',
    lang: 'en',
    data: { url: '', format: DEFAULT_PUSH_FORMAT },
    append: false,
  };
}

interface RawPusher {
  app_id?: unknown;
  pushkey?: unknown;
  app_display_name?: unknown;
  device_display_name?: unknown;
  lang?: unknown;
  enabled?: unknown;
  device_id?: unknown;
  data?: { url?: unknown } | null;
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/** Normalizes one entry of `GET /pushers`, which is server-controlled data. */
export function parsePusher(raw: unknown): Pusher {
  const source = (raw ?? {}) as RawPusher;
  return {
    appId: asString(source.app_id),
    pushkey: asString(source.pushkey),
    appDisplayName: asString(source.app_display_name),
    deviceDisplayName: asString(source.device_display_name),
    gatewayUrl: typeof source.data?.url === 'string' ? source.data.url : null,
    lang: asString(source.lang, 'en'),
    enabled: typeof source.enabled === 'boolean' ? source.enabled : null,
    deviceId: typeof source.device_id === 'string' ? source.device_id : null,
  };
}
