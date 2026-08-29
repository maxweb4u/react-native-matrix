import { buildPusherRemoval, buildPusherRequest, DEFAULT_PUSH_FORMAT, parsePusher } from '../pusher';

const options = {
  appId: 'org.example.app.ios',
  gatewayUrl: 'https://push.example.org/_matrix/push/v1/notify',
  appDisplayName: 'Example',
  deviceDisplayName: 'iPhone 16e',
};

describe('buildPusherRequest', () => {
  it('maps every option onto its wire field', () => {
    expect(buildPusherRequest(options, 'token-1')).toEqual({
      app_id: 'org.example.app.ios',
      pushkey: 'token-1',
      kind: 'http',
      app_display_name: 'Example',
      device_display_name: 'iPhone 16e',
      lang: 'en',
      data: {
        url: 'https://push.example.org/_matrix/push/v1/notify',
        format: DEFAULT_PUSH_FORMAT,
      },
      append: false,
    });
  });

  it('asks for identifiers only by default', () => {
    // Any other format sends message bodies through a third-party gateway.
    expect(buildPusherRequest(options, 't').data.format).toBe('event_id_only');
  });

  it('replaces other pushers by default', () => {
    // Appending on a rotated token leaves the old pusher registered and the
    // homeserver pushing to a key nothing reads.
    expect(buildPusherRequest(options, 't').append).toBe(false);
    expect(buildPusherRequest({ ...options, append: true }, 't').append).toBe(true);
  });

  it('takes the language and brand when given', () => {
    const request = buildPusherRequest({ ...options, lang: 'de', brand: 'quiet' }, 't');

    expect(request.lang).toBe('de');
    expect(request.data.brand).toBe('quiet');
  });

  it('omits brand entirely rather than sending an empty one', () => {
    expect(buildPusherRequest(options, 't').data).not.toHaveProperty('brand');
  });
});

describe('buildPusherRemoval', () => {
  it('is the same endpoint with a null kind, not a delete', () => {
    const removal = buildPusherRemoval('org.example.app.ios', 'token-1');

    expect(removal.kind).toBeNull();
    expect(removal.app_id).toBe('org.example.app.ios');
    expect(removal.pushkey).toBe('token-1');
  });
});

describe('parsePusher', () => {
  it('normalizes a homeserver response', () => {
    expect(
      parsePusher({
        app_id: 'org.example.app.ios',
        pushkey: 'token-1',
        app_display_name: 'Example',
        device_display_name: 'iPhone 16e',
        lang: 'de',
        enabled: true,
        device_id: 'DEVICE1',
        data: { url: 'https://push.example.org/notify' },
      }),
    ).toEqual({
      appId: 'org.example.app.ios',
      pushkey: 'token-1',
      appDisplayName: 'Example',
      deviceDisplayName: 'iPhone 16e',
      gatewayUrl: 'https://push.example.org/notify',
      lang: 'de',
      enabled: true,
      deviceId: 'DEVICE1',
    });
  });

  it('survives a response missing everything', () => {
    // Server-controlled data. A homeserver that omits the MSC3881 fields must
    // not produce undefined on a typed surface.
    expect(parsePusher({})).toEqual({
      appId: '',
      pushkey: '',
      appDisplayName: '',
      deviceDisplayName: '',
      gatewayUrl: null,
      lang: 'en',
      enabled: null,
      deviceId: null,
    });
  });

  it('rejects values of the wrong type rather than passing them through', () => {
    const pusher = parsePusher({ app_id: 42, enabled: 'yes', data: { url: 7 }, device_id: null });

    expect(pusher.appId).toBe('');
    expect(pusher.enabled).toBeNull();
    expect(pusher.gatewayUrl).toBeNull();
    expect(pusher.deviceId).toBeNull();
  });
});
