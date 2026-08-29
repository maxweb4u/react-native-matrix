import type { MatrixClient } from 'matrix-js-sdk';

import { isMxcUri, mediaFetchHeaders, mxcImageSource, mxcToHttpUrl, parseMxcUri } from '../mxc';

const fakeClient = (overrides: Partial<MatrixClient> = {}): MatrixClient =>
  ({
    mxcUrlToHttp: jest.fn(() => 'https://hs.example.org/_matrix/client/v1/media/download/s/abc'),
    getAccessToken: jest.fn(() => 'syt_token'),
    ...overrides,
  }) as unknown as MatrixClient;

describe('parseMxcUri', () => {
  it('parses a well-formed URI', () => {
    expect(parseMxcUri('mxc://example.org/AbC123')).toEqual({
      serverName: 'example.org',
      mediaId: 'AbC123',
    });
  });

  it('rejects anything that is not an mxc URI', () => {
    for (const input of [
      'https://example.org/file.png',
      'mxc://',
      'mxc://example.org',
      'mxc://example.org/',
      'mxc:///mediaId',
      'mxc://example.org/a/b',
      '',
      null,
      undefined,
      42 as unknown as string,
    ]) {
      expect(parseMxcUri(input as string)).toBeNull();
    }
  });

  it('exposes a boolean helper consistent with the parser', () => {
    expect(isMxcUri('mxc://example.org/id')).toBe(true);
    expect(isMxcUri('mxc://broken')).toBe(false);
  });
});

describe('mxcToHttpUrl', () => {
  it('requests an authenticated URL without direct links', () => {
    const client = fakeClient();
    const url = mxcToHttpUrl(client, 'mxc://example.org/abc');

    expect(url).toBe('https://hs.example.org/_matrix/client/v1/media/download/s/abc');
    expect(client.mxcUrlToHttp).toHaveBeenCalledWith(
      'mxc://example.org/abc',
      undefined,
      undefined,
      // No resize method: the SDK treats any of width, height or method as a
      // request for the thumbnail endpoint, so passing one here downloaded a
      // cropped thumbnail in place of the original file.
      undefined,
      false, // allowDirectLinks
      true, // allowRedirects
      true, // useAuthentication
    );
  });

  it('defaults the resize method only when a thumbnail was asked for', () => {
    const client = fakeClient();
    mxcToHttpUrl(client, 'mxc://example.org/abc', { thumbnail: { width: 48, height: 48 } });

    expect(client.mxcUrlToHttp).toHaveBeenCalledWith(
      'mxc://example.org/abc',
      48,
      48,
      'crop',
      false,
      true,
      true,
    );
  });

  it('passes thumbnail dimensions through', () => {
    const client = fakeClient();
    mxcToHttpUrl(client, 'mxc://example.org/abc', {
      thumbnail: { width: 96, height: 96, method: 'scale' },
    });

    expect(client.mxcUrlToHttp).toHaveBeenCalledWith(
      'mxc://example.org/abc',
      96,
      96,
      'scale',
      false,
      true,
      true,
    );
  });

  it('returns null for a malformed URI without calling the client', () => {
    const client = fakeClient();
    expect(mxcToHttpUrl(client, 'not-an-mxc-uri')).toBeNull();
    expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
  });
});

describe('mediaFetchHeaders', () => {
  it('sends the access token as a bearer header, never in the query string', () => {
    expect(mediaFetchHeaders(fakeClient())).toEqual({ Authorization: 'Bearer syt_token' });
  });

  it('omits the header when there is no token', () => {
    const client = fakeClient({ getAccessToken: jest.fn(() => null) } as Partial<MatrixClient>);
    expect(mediaFetchHeaders(client)).toEqual({});
  });
});

describe('mxcImageSource', () => {
  it('produces a source object React Native can render directly', () => {
    expect(mxcImageSource(fakeClient(), 'mxc://example.org/abc')).toEqual({
      uri: 'https://hs.example.org/_matrix/client/v1/media/download/s/abc',
      headers: { Authorization: 'Bearer syt_token' },
    });
  });

  it('returns null when the URI cannot be resolved so callers can fall back', () => {
    const client = fakeClient({ mxcUrlToHttp: jest.fn(() => null) } as Partial<MatrixClient>);
    expect(mxcImageSource(client, 'mxc://example.org/abc')).toBeNull();
  });
});
