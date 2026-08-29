/**
 * Decoding for `data:` URIs, because React Native's `fetch` cannot read them
 * on Android.
 *
 * On iOS `fetch('data:...')` resolves; on Android it rejects with
 * "Network request failed" before any request leaves the device. An adapter
 * that returns a generated or in-memory image — a signature pad, a cropped
 * canvas, a test fixture — hands the session exactly that shape, so the
 * library decodes these itself rather than documenting a platform difference
 * it can remove.
 *
 * See memory_bank/engineering/gotchas.md#react-native.
 */

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** True for a URI this module can decode. */
export function isDataUri(uri: string): boolean {
  return uri.startsWith('data:');
}

/**
 * Decodes standard base64 without `atob` or a dependency.
 *
 * Hermes exposes no `atob`, and React Native has only had one since 0.74, so
 * relying on it would put a silent version floor on a library that states its
 * floor in `package.json`.
 */
function decodeBase64(input: string): Uint8Array {
  const cleaned = input.replace(/[\r\n\s]/g, '');
  const unpadded = cleaned.replace(/=+$/, '');
  const bytes = new Uint8Array((unpadded.length * 3) / 4);

  let byteIndex = 0;
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const character of unpadded) {
    const value = BASE64_ALPHABET.indexOf(character);
    if (value === -1) {
      throw new Error(`Invalid base64 character "${character}" in data URI`);
    }
    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;
    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      bytes[byteIndex] = (buffer >> bitsInBuffer) & 0xff;
      byteIndex += 1;
    }
  }
  // Trailing bits that do not complete a byte are padding, not data.
  return bytes.subarray(0, byteIndex);
}

/** Percent-decoding for the non-base64 form, which is text in practice. */
function decodePercent(input: string): Uint8Array {
  const decoded = decodeURIComponent(input);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export interface DecodedDataUri {
  bytes: Uint8Array;
  /** The declared media type, or `text/plain` as RFC 2397 specifies. */
  mimeType: string;
}

/**
 * Splits a `data:` URI into its bytes and media type.
 *
 * @throws Error when the URI is not a well-formed data URI. The caller turns
 * this into a `MatrixRequestError` naming the URI, the same as an unreadable
 * `file://` path.
 */
export function decodeDataUri(uri: string): DecodedDataUri {
  if (!isDataUri(uri)) {
    throw new Error('Not a data URI');
  }
  const comma = uri.indexOf(',');
  if (comma === -1) {
    throw new Error('Malformed data URI: no comma separating the payload');
  }

  const header = uri.slice('data:'.length, comma);
  const payload = uri.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  const mimeType = (isBase64 ? header.replace(/;base64$/i, '') : header).split(';')[0] || '';

  return {
    bytes: isBase64 ? decodeBase64(payload) : decodePercent(payload),
    // RFC 2397: an omitted media type means text/plain.
    mimeType: mimeType || 'text/plain',
  };
}
