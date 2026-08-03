import { MessageKind, type GeoPosition, type MediaInfo } from '../types/content';

/**
 * Parses raw Matrix event content into normalized, typed fields.
 *
 * Everything here treats the input as hostile. Event content is written by
 * whoever sent the event, and 0.0.x copied it wholesale onto a model instance
 * (`Object.keys(content).map(f => this[f] = content[f])`). Since the model's
 * prototype exposed getters without setters, a sender could crash every other
 * client in the room simply by including a key called `message` or `type`:
 * assigning to a getter-only property throws in strict mode, which ES modules
 * always are.
 *
 * The rule now is that no attacker-controlled key ever reaches an object
 * property name. Fields are read one by one and type-checked.
 *
 * See memory_bank/domain/timeline.md#content-parsing.
 */

/** Raw content is unknown data; these helpers narrow it safely. */
function readString(source: unknown, key: string): string | null {
  if (typeof source !== 'object' || source === null) {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function readNumber(source: unknown, key: string): number | null {
  if (typeof source !== 'object' || source === null) {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readObject(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'object' && value !== null ? value : null;
}

/** msgtype values this library renders. Anything else becomes `unsupported`. */
const KIND_BY_MSGTYPE: Readonly<Record<string, MessageKind>> = {
  'm.text': MessageKind.Text,
  'm.emote': MessageKind.Emote,
  'm.notice': MessageKind.Notice,
  'm.image': MessageKind.Image,
  'm.file': MessageKind.File,
  'm.audio': MessageKind.Audio,
  'm.video': MessageKind.Video,
  'm.location': MessageKind.Location,
};

const MEDIA_KINDS = new Set<MessageKind>([
  MessageKind.Image,
  MessageKind.File,
  MessageKind.Audio,
  MessageKind.Video,
]);

export function kindFromMsgType(msgtype: string | null): MessageKind {
  if (msgtype === null) {
    return MessageKind.Unsupported;
  }
  return KIND_BY_MSGTYPE[msgtype] ?? MessageKind.Unsupported;
}

export function isMediaKind(kind: MessageKind): boolean {
  return MEDIA_KINDS.has(kind);
}

/** Extracts the plain-text body, guaranteed to be a string. */
export function parseBody(content: unknown): string {
  return readString(content, 'body') ?? '';
}

/**
 * Extracts HTML formatting, but only when the sender declared the one format
 * the spec defines. An unknown `format` value means the body is not HTML.
 */
export function parseFormattedBody(content: unknown): string | null {
  if (readString(content, 'format') !== 'org.matrix.custom.html') {
    return null;
  }
  return readString(content, 'formatted_body');
}

/** Extracts attachment metadata. Returns null for non-media content. */
export function parseMediaInfo(content: unknown): MediaInfo | null {
  const info = readObject(content, 'info');
  const mxcUri = readString(content, 'url');
  const thumbnailMxcUri = readString(info, 'thumbnail_url');

  if (!mxcUri && !thumbnailMxcUri && !info) {
    return null;
  }

  return {
    mxcUri,
    localUri: null,
    mimeType: readString(info, 'mimetype'),
    size: readNumber(info, 'size'),
    width: readNumber(info, 'w'),
    height: readNumber(info, 'h'),
    durationMs: readNumber(info, 'duration'),
    thumbnailMxcUri,
    // Blurhash lives under an unstable prefix until MSC2448 lands.
    blurhash: readString(info, 'xyz.amp.blurhash') ?? readString(info, 'blurhash'),
  };
}

const GEO_URI = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:;u=(\d+(?:\.\d+)?))?/;

/** Parses `geo:lat,long;u=uncertainty`. Returns null when malformed. */
export function parseGeoUri(geoUri: string | null): GeoPosition | null {
  if (!geoUri) {
    return null;
  }
  const match = GEO_URI.exec(geoUri);
  if (!match) {
    return null;
  }
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  const uncertainty = match[3] === undefined ? null : Number(match[3]);
  return {
    latitude,
    longitude,
    uncertainty: uncertainty !== null && Number.isFinite(uncertainty) ? uncertainty : null,
  };
}

export function parseLocation(content: unknown): GeoPosition | null {
  return parseGeoUri(readString(content, 'geo_uri'));
}

export interface ParsedRelation {
  /** `m.replace`, `m.annotation`, `m.thread`, or null when unrelated. */
  relType: string | null;
  relatesToEventId: string | null;
  /** Reaction key for `m.annotation`. */
  key: string | null;
  /** Target of `m.in_reply_to`, which is nested one level deeper. */
  inReplyToEventId: string | null;
}

/** Reads `m.relates_to` without trusting its shape. */
export function parseRelation(content: unknown): ParsedRelation {
  const relatesTo = readObject(content, 'm.relates_to');
  const inReplyTo = readObject(relatesTo, 'm.in_reply_to');
  return {
    relType: readString(relatesTo, 'rel_type'),
    relatesToEventId: readString(relatesTo, 'event_id'),
    key: readString(relatesTo, 'key'),
    inReplyToEventId: readString(inReplyTo, 'event_id'),
  };
}

/**
 * Returns the effective content of an edited event.
 *
 * An `m.replace` event carries the replacement under `m.new_content`; the
 * top-level body is only a `* fallback` for clients without edit support.
 */
export function parseNewContent(content: unknown): unknown {
  return readObject(content, 'm.new_content');
}
