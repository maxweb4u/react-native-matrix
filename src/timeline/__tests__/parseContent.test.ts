import { MessageKind } from '../../types/content';
import {
  isMediaKind,
  kindFromMsgType,
  parseBody,
  parseFormattedBody,
  parseGeoUri,
  parseLocation,
  parseMediaInfo,
  parseNewContent,
  parseRelation,
} from '../parseContent';

describe('hostile content', () => {
  // The 0.0.x model copied every key of the event content onto itself. Because
  // the prototype had getter-only accessors, content sent by any room member
  // could crash rendering for everyone else. These cases pin that shut.
  const hostilePayloads: unknown[] = [
    { msgtype: 'm.text', body: 'hi', message: 'shadowing a getter' },
    { msgtype: 'm.text', body: 'hi', type: 'shadowing a getter' },
    { msgtype: 'm.text', body: 'hi', quoteText: 'x', messageOnly: 'y' },
    { msgtype: 'm.text', body: 'hi', __proto__: { polluted: true } },
    { msgtype: 'm.text', body: 'hi', constructor: 'nope' },
    { msgtype: 'm.text', body: 'hi', toString: 'not a function' },
  ];

  it.each(hostilePayloads)('parses %p without throwing', (content) => {
    expect(() => {
      parseBody(content);
      parseFormattedBody(content);
      parseMediaInfo(content);
      parseRelation(content);
      parseLocation(content);
    }).not.toThrow();
    expect(parseBody(content)).toBe('hi');
  });

  it('does not pollute Object.prototype', () => {
    parseBody(JSON.parse('{"body":"x","__proto__":{"polluted":true}}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([null, undefined, 42, 'string', [], true])(
    'treats non-object content (%p) as empty',
    (content) => {
      expect(parseBody(content)).toBe('');
      expect(parseFormattedBody(content)).toBeNull();
      expect(parseMediaInfo(content)).toBeNull();
      expect(parseRelation(content).relType).toBeNull();
    },
  );
});

describe('parseBody', () => {
  it('returns the body when it is a string', () => {
    expect(parseBody({ body: 'hello' })).toBe('hello');
  });

  it('returns an empty string when the body has the wrong type', () => {
    expect(parseBody({ body: { nested: true } })).toBe('');
    expect(parseBody({ body: 12345 })).toBe('');
    expect(parseBody({})).toBe('');
  });
});

describe('parseFormattedBody', () => {
  it('accepts only the spec-defined format', () => {
    expect(
      parseFormattedBody({ format: 'org.matrix.custom.html', formatted_body: '<b>x</b>' }),
    ).toBe('<b>x</b>');
  });

  it('ignores an unknown format even when formatted_body is present', () => {
    expect(parseFormattedBody({ format: 'text/markdown', formatted_body: '**x**' })).toBeNull();
    expect(parseFormattedBody({ formatted_body: '<b>x</b>' })).toBeNull();
  });
});

describe('kindFromMsgType', () => {
  it.each([
    ['m.text', MessageKind.Text],
    ['m.emote', MessageKind.Emote],
    ['m.notice', MessageKind.Notice],
    ['m.image', MessageKind.Image],
    ['m.file', MessageKind.File],
    ['m.audio', MessageKind.Audio],
    ['m.video', MessageKind.Video],
    ['m.location', MessageKind.Location],
  ])('maps %s', (msgtype, expected) => {
    expect(kindFromMsgType(msgtype)).toBe(expected);
  });

  it('maps unknown and missing msgtypes to unsupported', () => {
    expect(kindFromMsgType('m.key.verification.request')).toBe(MessageKind.Unsupported);
    expect(kindFromMsgType('made.up')).toBe(MessageKind.Unsupported);
    expect(kindFromMsgType(null)).toBe(MessageKind.Unsupported);
  });

  it('classifies which kinds carry an attachment', () => {
    expect(isMediaKind(MessageKind.Image)).toBe(true);
    expect(isMediaKind(MessageKind.Video)).toBe(true);
    expect(isMediaKind(MessageKind.Text)).toBe(false);
    expect(isMediaKind(MessageKind.Location)).toBe(false);
  });
});

describe('parseMediaInfo', () => {
  it('reads url and info fields', () => {
    const media = parseMediaInfo({
      msgtype: 'm.image',
      body: 'photo.jpg',
      url: 'mxc://example.org/abc',
      info: {
        mimetype: 'image/jpeg',
        size: 2048,
        w: 800,
        h: 600,
        thumbnail_url: 'mxc://example.org/thumb',
        'xyz.amp.blurhash': 'LKO2',
      },
    });

    expect(media).toEqual({
      mxcUri: 'mxc://example.org/abc',
      localUri: null,
      mimeType: 'image/jpeg',
      size: 2048,
      width: 800,
      height: 600,
      durationMs: null,
      thumbnailMxcUri: 'mxc://example.org/thumb',
      blurhash: 'LKO2',
    });
  });

  it('reads audio duration', () => {
    const media = parseMediaInfo({
      url: 'mxc://example.org/a',
      info: { mimetype: 'audio/mp4', duration: 15_000 },
    });
    expect(media?.durationMs).toBe(15_000);
  });

  it('drops fields with the wrong type instead of propagating them', () => {
    const media = parseMediaInfo({
      url: 'mxc://example.org/abc',
      info: { size: '2048', w: null, mimetype: { evil: true }, duration: Number.NaN },
    });
    expect(media).toMatchObject({
      mxcUri: 'mxc://example.org/abc',
      size: null,
      width: null,
      mimeType: null,
      durationMs: null,
    });
  });

  it('returns null for content with no attachment at all', () => {
    expect(parseMediaInfo({ msgtype: 'm.text', body: 'hello' })).toBeNull();
  });
});

describe('parseGeoUri', () => {
  it('parses latitude, longitude and uncertainty', () => {
    expect(parseGeoUri('geo:51.5074,-0.1278;u=35')).toEqual({
      latitude: 51.5074,
      longitude: -0.1278,
      uncertainty: 35,
    });
  });

  it('parses a URI without uncertainty', () => {
    expect(parseGeoUri('geo:0,0')).toEqual({ latitude: 0, longitude: 0, uncertainty: null });
  });

  it.each([
    'geo:',
    'geo:abc,def',
    'https://maps.example.org/?q=1,2',
    'geo:91,0',
    'geo:0,181',
    '',
    null,
  ])('rejects %p', (input) => {
    expect(parseGeoUri(input as string)).toBeNull();
  });

  it('reads the geo_uri field of location content', () => {
    expect(parseLocation({ msgtype: 'm.location', geo_uri: 'geo:1,2' })).toEqual({
      latitude: 1,
      longitude: 2,
      uncertainty: null,
    });
  });
});

describe('parseRelation', () => {
  it('reads an annotation', () => {
    expect(
      parseRelation({
        'm.relates_to': { rel_type: 'm.annotation', event_id: '$target', key: '👍' },
      }),
    ).toEqual({
      relType: 'm.annotation',
      relatesToEventId: '$target',
      key: '👍',
      inReplyToEventId: null,
    });
  });

  it('reads a nested in_reply_to', () => {
    expect(
      parseRelation({ 'm.relates_to': { 'm.in_reply_to': { event_id: '$quoted' } } }),
    ).toMatchObject({ inReplyToEventId: '$quoted', relType: null });
  });

  it('reads a thread relation', () => {
    expect(
      parseRelation({ 'm.relates_to': { rel_type: 'm.thread', event_id: '$root' } }),
    ).toMatchObject({ relType: 'm.thread', relatesToEventId: '$root' });
  });

  it('survives a relates_to of the wrong shape', () => {
    expect(parseRelation({ 'm.relates_to': 'not-an-object' })).toEqual({
      relType: null,
      relatesToEventId: null,
      key: null,
      inReplyToEventId: null,
    });
  });
});

describe('parseNewContent', () => {
  it('returns the replacement content of an edit', () => {
    expect(parseNewContent({ 'm.new_content': { body: 'fixed' } })).toEqual({ body: 'fixed' });
  });

  it('returns null when there is no replacement', () => {
    expect(parseNewContent({ body: 'plain' })).toBeNull();
  });
});
