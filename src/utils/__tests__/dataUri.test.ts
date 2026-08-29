import { decodeDataUri, isDataUri } from '../dataUri';

/** The 8×8 blue PNG the example app's stand-in picker returns. */
const SAMPLE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQoz2NkYPjPQApgYhhVMKpg' +
  'VMGoglEFVFAAAI0AAv7wJ0YAAAAASUVORK5CYII=';

const bytesOf = (uri: string): number[] => Array.from(decodeDataUri(uri).bytes);

describe('isDataUri', () => {
  it('recognises a data URI', () => {
    expect(isDataUri('data:image/png;base64,AAAA')).toBe(true);
  });

  it('rejects the URIs a real picker returns', () => {
    expect(isDataUri('file:///storage/photo.jpg')).toBe(false);
    expect(isDataUri('content://media/external/images/1')).toBe(false);
    expect(isDataUri('https://example.org/photo.jpg')).toBe(false);
  });
});

describe('decodeDataUri', () => {
  it('decodes base64 payloads', () => {
    // "Man" is the canonical three-byte example: it needs no padding.
    expect(bytesOf('data:text/plain;base64,TWFu')).toEqual([77, 97, 110]);
  });

  it('decodes payloads with one padding character', () => {
    expect(bytesOf('data:text/plain;base64,TWE=')).toEqual([77, 97]);
  });

  it('decodes payloads with two padding characters', () => {
    expect(bytesOf('data:text/plain;base64,TQ==')).toEqual([77]);
  });

  it('decodes a real PNG to the right length and magic number', () => {
    const { bytes, mimeType } = decodeDataUri(`data:image/png;base64,${SAMPLE_PNG}`);

    expect(mimeType).toBe('image/png');
    // PNG signature: \x89 P N G
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(bytes.byteLength).toBe(Math.floor((SAMPLE_PNG.replace(/=+$/, '').length * 3) / 4));
  });

  it('handles the full byte range, not just ASCII', () => {
    // 0x00 and 0xff both round-trip; a decoder that used charCodeAt on a
    // latin-1 string would corrupt the high byte.
    expect(bytesOf('data:application/octet-stream;base64,AP8A')).toEqual([0, 255, 0]);
  });

  it('ignores whitespace and newlines inside the payload', () => {
    expect(bytesOf('data:text/plain;base64,TW\nFu')).toEqual([77, 97, 110]);
  });

  it('decodes percent-encoded payloads', () => {
    expect(bytesOf('data:text/plain,hello%20world')).toEqual(
      Array.from('hello world', (c) => c.charCodeAt(0)),
    );
  });

  it('defaults to text/plain when no media type is declared', () => {
    // RFC 2397 says so, and the msgtype is derived from LocalFile anyway.
    expect(decodeDataUri('data:,hi').mimeType).toBe('text/plain');
  });

  it('drops parameters from the media type', () => {
    expect(decodeDataUri('data:text/plain;charset=utf-8,hi').mimeType).toBe('text/plain');
  });

  it('returns empty bytes for an empty payload', () => {
    expect(bytesOf('data:image/png;base64,')).toEqual([]);
  });

  it('rejects a URI with no comma', () => {
    expect(() => decodeDataUri('data:image/png;base64')).toThrow(/comma/);
  });

  it('rejects a payload containing a character outside the alphabet', () => {
    expect(() => decodeDataUri('data:image/png;base64,TW*u')).toThrow(/Invalid base64/);
  });

  it('rejects a URI that is not a data URI at all', () => {
    expect(() => decodeDataUri('file:///photo.jpg')).toThrow(/Not a data URI/);
  });
});
