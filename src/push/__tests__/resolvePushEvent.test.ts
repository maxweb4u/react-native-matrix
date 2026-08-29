import { MessageKind } from '../../types/content';
import { PushEventKind } from '../../types/push';
import { buildPushNotification } from '../resolvePushEvent';

const payload = { roomId: '!room:localhost', eventId: '$event:localhost' };

const named = { roomName: 'Deployments', senderDisplayName: 'Bob' };
const unnamed = { roomName: null, senderDisplayName: null };

const message = (content: Record<string, unknown>) => ({
  type: 'm.room.message',
  sender: '@bob:localhost',
  origin_server_ts: 1700,
  content,
});

describe('buildPushNotification', () => {
  it('maps a text message onto everything a host needs to render it', () => {
    const notification = buildPushNotification(
      payload,
      message({ msgtype: 'm.text', body: 'hello' }),
      named,
    );

    expect(notification).toEqual({
      kind: PushEventKind.Message,
      roomId: '!room:localhost',
      eventId: '$event:localhost',
      roomName: 'Deployments',
      senderId: '@bob:localhost',
      senderDisplayName: 'Bob',
      body: 'hello',
      messageKind: MessageKind.Text,
      ts: 1700,
    });
  });

  it('returns the encrypted kind with no body, rather than a blank message', () => {
    // There is no crypto backend in a background task on stock React Native,
    // so this can never carry a body. The host shows a generic string; a
    // message kind with a null body would render an empty notification.
    const notification = buildPushNotification(
      payload,
      { type: 'm.room.encrypted', sender: '@bob:localhost', content: {} },
      named,
    );

    expect(notification.kind).toBe(PushEventKind.Encrypted);
    expect(notification.body).toBeNull();
    expect(notification.messageKind).toBeNull();
  });

  it('marks a state event as other', () => {
    const notification = buildPushNotification(
      payload,
      { type: 'm.room.member', sender: '@bob:localhost', content: { membership: 'join' } },
      named,
    );

    expect(notification.kind).toBe(PushEventKind.Other);
    expect(notification.body).toBeNull();
  });

  it('falls back to the room ID when the room has no name', () => {
    const notification = buildPushNotification(
      payload,
      message({ msgtype: 'm.text', body: 'hi' }),
      unnamed,
    );

    expect(notification.roomName).toBe('!room:localhost');
  });

  it('falls back to the user ID when the member is not in state', () => {
    const notification = buildPushNotification(
      payload,
      message({ msgtype: 'm.text', body: 'hi' }),
      unnamed,
    );

    expect(notification.senderDisplayName).toBe('@bob:localhost');
  });

  it('parses the body through the timeline whitelist, not straight through', () => {
    // This string goes to the operating system's notification centre, and it
    // is as attacker-controlled as any other event content.
    const notification = buildPushNotification(
      payload,
      message({ msgtype: 'm.text', body: { evil: true } }),
      named,
    );

    expect(typeof notification.body).toBe('string');
  });

  it('reports the kind of an attachment', () => {
    const notification = buildPushNotification(
      payload,
      message({ msgtype: 'm.image', body: 'photo.png' }),
      named,
    );

    expect(notification.messageKind).toBe(MessageKind.Image);
  });

  it('reports an unknown msgtype as unsupported rather than as text', () => {
    const notification = buildPushNotification(
      payload,
      message({ msgtype: 'm.invented', body: 'x' }),
      named,
    );

    expect(notification.messageKind).toBe(MessageKind.Unsupported);
  });

  it('survives an event with no sender, type or timestamp', () => {
    // A federated or malformed event must not throw inside a background task,
    // where nothing is watching to report it.
    const notification = buildPushNotification(payload, {}, unnamed);

    expect(notification.kind).toBe(PushEventKind.Other);
    expect(notification.senderId).toBe('');
    expect(notification.senderDisplayName).toBe('');
    expect(notification.ts).toBe(0);
  });

  it('ignores a timestamp of the wrong type', () => {
    const notification = buildPushNotification(
      payload,
      { ...message({ msgtype: 'm.text', body: 'hi' }), origin_server_ts: '1700' as never },
      named,
    );

    expect(notification.ts).toBe(0);
  });
});
