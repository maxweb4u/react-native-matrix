import { splitReplyFallback } from '../quote';

describe('splitReplyFallback', () => {
  it('splits the fallback from the reply body', () => {
    const raw = '> <@alice:example.org> hello there\n\nhi back';
    expect(splitReplyFallback(raw)).toEqual({
      quoted: '<@alice:example.org> hello there',
      body: 'hi back',
    });
  });

  it('keeps multi-line quotes and multi-line replies intact', () => {
    const raw = '> <@a:e.org> first\n> second\n\nline one\nline two';
    expect(splitReplyFallback(raw)).toEqual({
      quoted: '<@a:e.org> first\nsecond',
      body: 'line one\nline two',
    });
  });

  it('does not treat a comparison inside a message as a quote', () => {
    // 0.0.x used indexOf('> ') and mangled messages like this one.
    const raw = 'the check is 2 > 1 for every input';
    expect(splitReplyFallback(raw)).toEqual({ quoted: null, body: raw });
  });

  it('preserves an interior quote-looking line in the body', () => {
    const raw = '> <@a:e.org> quoted\n\nreply\n> not a fallback';
    expect(splitReplyFallback(raw)).toEqual({
      quoted: '<@a:e.org> quoted',
      body: 'reply\n> not a fallback',
    });
  });

  it('handles a blank quoted line', () => {
    const raw = '> <@a:e.org> first\n>\n> third\n\nbody';
    expect(splitReplyFallback(raw).quoted).toBe('<@a:e.org> first\n\nthird');
  });

  it('returns an empty body when the reply is only a quote', () => {
    expect(splitReplyFallback('> <@a:e.org> orphan')).toEqual({
      quoted: '<@a:e.org> orphan',
      body: '',
    });
  });

  it('tolerates empty and non-string input', () => {
    expect(splitReplyFallback('')).toEqual({ quoted: null, body: '' });
    expect(splitReplyFallback(undefined as unknown as string)).toEqual({ quoted: null, body: '' });
  });
});
