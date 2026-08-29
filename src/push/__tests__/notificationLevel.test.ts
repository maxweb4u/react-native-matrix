import type { MatrixClient } from 'matrix-js-sdk';

import { NotificationLevel } from '../../types/push';
import { applyNotificationLevel, isSuppressing, readNotificationLevel } from '../notificationLevel';

const ROOM = '!room:localhost';

const rules = (global: Record<string, unknown[]>) => ({ global }) as never;

const roomMatch = (roomId: string) => ({
  kind: 'event_match',
  key: 'room_id',
  pattern: roomId,
});

describe('isSuppressing', () => {
  it('reads the historical action', () => {
    expect(isSuppressing(['dont_notify'])).toBe(true);
  });

  it('reads the current spelling, an empty action list', () => {
    // Both are live. Reading only one misreports rooms silenced elsewhere.
    expect(isSuppressing([])).toBe(true);
  });

  it('does not treat a notifying rule as suppression', () => {
    expect(isSuppressing(['notify', { set_tweak: 'sound', value: 'default' }])).toBe(false);
  });

  it('treats missing actions as no suppression', () => {
    expect(isSuppressing(undefined)).toBe(false);
  });
});

describe('readNotificationLevel', () => {
  it('reports "all" when the account has no rule for the room', () => {
    expect(readNotificationLevel(rules({}), ROOM)).toBe(NotificationLevel.All);
  });

  it('reports "mentions" for a room-kind suppression', () => {
    // A room-kind rule sits below the mention overrides, so mentions survive.
    const level = readNotificationLevel(
      rules({ room: [{ rule_id: ROOM, actions: ['dont_notify'], enabled: true }] }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.Mentions);
  });

  it('reports "mute" for an override suppression', () => {
    const level = readNotificationLevel(
      rules({
        override: [
          { rule_id: ROOM, actions: ['dont_notify'], enabled: true, conditions: [roomMatch(ROOM)] },
        ],
      }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.Mute);
  });

  it('lets the override win when both kinds are present', () => {
    // The quieter of the two is what the user actually experiences.
    const level = readNotificationLevel(
      rules({
        override: [{ rule_id: ROOM, actions: [], enabled: true }],
        room: [{ rule_id: ROOM, actions: ['dont_notify'], enabled: true }],
      }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.Mute);
  });

  it('matches a rule by its room_id condition, not only by its ID', () => {
    // Other clients name the rule freely and identify the room in a condition.
    const level = readNotificationLevel(
      rules({
        override: [
          { rule_id: '.client.generated.7', actions: [], enabled: true, conditions: [roomMatch(ROOM)] },
        ],
      }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.Mute);
  });

  it('ignores a rule for a different room', () => {
    const level = readNotificationLevel(
      rules({ room: [{ rule_id: '!other:localhost', actions: ['dont_notify'], enabled: true }] }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.All);
  });

  it('ignores a disabled rule', () => {
    // A disabled rule is still stored. Reading it as active reports a room as
    // muted while it is notifying.
    const level = readNotificationLevel(
      rules({ room: [{ rule_id: ROOM, actions: ['dont_notify'], enabled: false }] }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.All);
  });

  it('ignores a rule for this room that notifies', () => {
    const level = readNotificationLevel(
      rules({ room: [{ rule_id: ROOM, actions: ['notify'], enabled: true }] }),
      ROOM,
    );

    expect(level).toBe(NotificationLevel.All);
  });

  it('treats absent rules as "all" rather than throwing', () => {
    expect(readNotificationLevel(null, ROOM)).toBe(NotificationLevel.All);
    expect(readNotificationLevel(undefined, ROOM)).toBe(NotificationLevel.All);
  });
});

interface Call {
  method: string;
  kind?: string;
  ruleId?: string;
  body?: unknown;
}

function fakeClient(existing: Record<string, unknown[]> = {}): {
  client: MatrixClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const client = {
    getPushRules: async () => {
      calls.push({ method: 'getPushRules' });
      return { global: existing };
    },
    deletePushRule: async (_scope: string, kind: string, ruleId: string) => {
      calls.push({ method: 'deletePushRule', kind, ruleId });
    },
    addPushRule: async (_scope: string, kind: string, ruleId: string, body: unknown) => {
      calls.push({ method: 'addPushRule', kind, ruleId, body });
    },
  } as unknown as MatrixClient;
  return { client, calls };
}

describe('applyNotificationLevel', () => {
  it('writes an override rule for "mute", not a room rule', () => {
    // The SDK's own setRoomMutePushRule writes a room-kind rule, which leaves
    // mentions audible. That is "mentions", and using it here would mean a
    // muted room still buzzing on every @mention.
    const { client, calls } = fakeClient();

    return applyNotificationLevel(client, ROOM, NotificationLevel.Mute).then(() => {
      const added = calls.find((call) => call.method === 'addPushRule');
      expect(added?.kind).toBe('override');
      expect(added?.body).toEqual({
        actions: ['dont_notify'],
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: ROOM }],
      });
    });
  });

  it('writes a room rule for "mentions"', async () => {
    const { client, calls } = fakeClient();

    await applyNotificationLevel(client, ROOM, NotificationLevel.Mentions);

    const added = calls.find((call) => call.method === 'addPushRule');
    expect(added?.kind).toBe('room');
    expect(added?.body).toEqual({ actions: ['dont_notify'] });
  });

  it('writes nothing for "all" — the level is the absence of a rule', async () => {
    const { client, calls } = fakeClient();

    await applyNotificationLevel(client, ROOM, NotificationLevel.All);

    expect(calls.filter((call) => call.method === 'addPushRule')).toEqual([]);
  });

  it('clears the other kind before writing, so the two cannot coexist', async () => {
    // A leftover override under a new room rule reads as "mentions" in any UI
    // while the room is in fact silent.
    const { client, calls } = fakeClient({
      override: [{ rule_id: ROOM, actions: ['dont_notify'], enabled: true }],
    });

    await applyNotificationLevel(client, ROOM, NotificationLevel.Mentions);

    const deleted = calls.filter((call) => call.method === 'deletePushRule');
    expect(deleted.map((call) => call.kind)).toEqual(['override']);
    expect(calls.indexOf(deleted[0] as Call)).toBeLessThan(
      calls.findIndex((call) => call.method === 'addPushRule'),
    );
  });

  it('removes both kinds when going back to "all"', async () => {
    const { client, calls } = fakeClient({
      override: [{ rule_id: ROOM, actions: [], enabled: true }],
      room: [{ rule_id: ROOM, actions: ['dont_notify'], enabled: true }],
    });

    await applyNotificationLevel(client, ROOM, NotificationLevel.All);

    expect(calls.filter((call) => call.method === 'deletePushRule').map((call) => call.kind)).toEqual(
      ['override', 'room'],
    );
  });

  it('deletes a rule by the ID the server gave it', async () => {
    const { client, calls } = fakeClient({
      override: [
        { rule_id: '.client.generated.7', actions: [], enabled: true, conditions: [roomMatch(ROOM)] },
      ],
    });

    await applyNotificationLevel(client, ROOM, NotificationLevel.All);

    expect(calls.find((call) => call.method === 'deletePushRule')?.ruleId).toBe(
      '.client.generated.7',
    );
  });
});
