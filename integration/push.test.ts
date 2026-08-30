/**
 * Push against a real homeserver.
 *
 * Everything here is the half of push this library owns: registering a pusher,
 * expressing notification rules, and turning a push payload back into
 * something renderable. Actual delivery needs a push gateway and a real FCM or
 * APNs project, so it is out of reach here and stated in
 * memory_bank/domain/push.md rather than pretended at.
 */

import { NotificationLevel } from '../src/types/push';
import { resolvePushEvent } from '../src/push/resolvePushEvent';
import { PushEventKind } from '../src/types/push';
import { buildPusherRemoval } from '../src/push/pusher';
import { createSharedRoom, startSession, stopEverything, waitFor } from './support/harness';
import { ALICE, BOB, login } from './support/homeserver';

const APP_ID = 'org.example.reactnativematrix.test';
const GATEWAY = 'https://push.example.invalid/_matrix/push/v1/notify';

const pusherOptions = (pushkey: string) => ({
  appId: APP_ID,
  gatewayUrl: GATEWAY,
  appDisplayName: 'Integration suite',
  deviceDisplayName: 'Jest',
  pushkey,
});

/**
 * Pushers live on the account, not on the session, so a crashed run leaves
 * them behind and poisons the next one. Cleared before and after.
 */
async function clearOurPushers(): Promise<void> {
  const session = await startSession(ALICE);
  const client = session.getClient();
  for (const pusher of (await session.getPushers()).filter((p) => p.appId === APP_ID)) {
    await client.setPusher(buildPusherRemoval(APP_ID, pusher.pushkey) as never);
  }
}

beforeAll(async () => {
  await clearOurPushers();
});

afterAll(async () => {
  await clearOurPushers();
  stopEverything();
});

describe('pushers', () => {
  it('registers a pusher the homeserver reports back', async () => {
    const alice = await startSession(ALICE);
    const pushkey = `key-${alice.userId}-register`;

    await alice.registerPusher(pusherOptions(pushkey));

    const pushers = await alice.getPushers();
    const mine = pushers.find((pusher) => pusher.pushkey === pushkey);
    expect(mine).toBeDefined();
    expect(mine?.appId).toBe(APP_ID);
    expect(mine?.gatewayUrl).toBe(GATEWAY);
    expect(mine?.appDisplayName).toBe('Integration suite');

    await alice.unregisterPusher();
  });

  it('removes the pusher, which sign-out depends on', async () => {
    // A pusher outlives the access token that made it. Without removal the
    // device keeps waking for an account the user has signed out of.
    const alice = await startSession(ALICE);
    const pushkey = `key-${alice.userId}-remove`;

    await alice.registerPusher(pusherOptions(pushkey));
    await alice.unregisterPusher();

    const pushers = await alice.getPushers();
    expect(pushers.find((pusher) => pusher.pushkey === pushkey)).toBeUndefined();
  });

  it('removes the previous pushkey when the token rotates', async () => {
    // `append: false` does not do this: it deduplicates the same pushkey
    // across users, not a user's own old token. Without an explicit deletion
    // the homeserver keeps pushing to a key nothing reads.
    const alice = await startSession(ALICE);
    const first = `key-${alice.userId}-rotate-1`;
    const second = `key-${alice.userId}-rotate-2`;

    await alice.registerPusher(pusherOptions(first));
    await alice.registerPusher(pusherOptions(second));

    const pushers = await alice.getPushers();
    const mine = pushers.filter((pusher) => pusher.appId === APP_ID);
    expect(mine.map((pusher) => pusher.pushkey)).toEqual([second]);

    await alice.unregisterPusher();
  });
});

  it('removes a pusher this session never registered, which sign-out after a restart is', async () => {
    // The ordinary sign-out: the pusher was written on a previous launch and a
    // fresh session knows nothing about it. Without an explicit target this
    // removes nothing, and the device keeps waking for a signed-out account.
    const first = await startSession(ALICE);
    const pushkey = 'key-across-launches';
    await first.registerPusher(pusherOptions(pushkey));

    const restarted = await startSession(ALICE);
    const removed = await restarted.unregisterPusher({ appId: APP_ID, pushkey });

    expect(removed).toBe(pushkey);
    expect((await restarted.getPushers()).some((p) => p.pushkey === pushkey)).toBe(false);
  });

  it('takes the pushkey from the adapter when only the app ID is known', async () => {
    const pushkey = 'key-from-adapter';
    const alice = await startSession(ALICE, {
      adapters: { pushToken: { getToken: async () => pushkey } },
    });
    await alice.registerPusher({
      appId: APP_ID,
      gatewayUrl: GATEWAY,
      appDisplayName: 'Integration suite',
      deviceDisplayName: 'Jest',
    });

    const restarted = await startSession(ALICE, {
      adapters: { pushToken: { getToken: async () => pushkey } },
    });
    expect(await restarted.unregisterPusher({ appId: APP_ID })).toBe(pushkey);
    expect((await restarted.getPushers()).some((p) => p.pushkey === pushkey)).toBe(false);
  });

  it('reports that there was nothing to remove', async () => {
    const alice = await startSession(ALICE);

    expect(await alice.unregisterPusher()).toBeNull();
  });

  it('refuses to register with no adapter at all, rather than doing nothing', async () => {
    // The project's rule: a missing adapter is never a silent no-op. Returning
    // null here would look identical to "permission not granted yet", and an
    // application would never learn it had forgotten to wire the adapter.
    const alice = await startSession(ALICE);

    await expect(
      alice.registerPusher({
        appId: APP_ID,
        gatewayUrl: GATEWAY,
        appDisplayName: 'Integration suite',
        deviceDisplayName: 'Jest',
      }),
    ).rejects.toThrow('pushToken');
  });

  it('registers as soon as a token arrives, when there was none at first', async () => {
    // The ordinary first launch: permission has not been granted, so the
    // adapter has nothing. Returning without watching would mean this device
    // never registers at all, however long the user waits.
    let notify: ((token: string) => void) | null = null;
    const pushkey = 'key-late-token';
    const alice = await startSession(ALICE, {
      adapters: {
        pushToken: {
          getToken: async () => null,
          onTokenRefresh: (listener) => {
            notify = listener;
            return () => {
              notify = null;
            };
          },
        },
      },
    });

    const immediate = await alice.registerPusher({
      appId: APP_ID,
      gatewayUrl: GATEWAY,
      appDisplayName: 'Integration suite',
      deviceDisplayName: 'Jest',
    });
    expect(immediate).toBeNull();
    expect(notify).not.toBeNull();

    notify?.(pushkey);
    await waitFor('the late token to be registered', async () =>
      (await alice.getPushers()).some((pusher) => pusher.pushkey === pushkey),
    );

    // The registration was fire-and-forget from the adapter's callback, so the
    // session may not have recorded it at the instant the server has. Waiting
    // for the removal to be visible is the only honest way to assert cleanup.
    await alice.unregisterPusher();
    await waitFor('the late token to be removed', async () =>
      (await alice.getPushers()).every((pusher) => pusher.pushkey !== pushkey),
    );
  });

describe('notification levels', () => {
  it('defaults to notifying for everything', async () => {
    const alice = await startSession(ALICE);
    const roomId = await alice.createRoom({ name: 'Push default' });

    expect(await alice.getNotificationLevel(roomId)).toBe(NotificationLevel.All);
  });

  it('round-trips every level through the homeserver', async () => {
    const alice = await startSession(ALICE);
    const roomId = await alice.createRoom({ name: 'Push levels' });

    for (const level of [
      NotificationLevel.Mute,
      NotificationLevel.Mentions,
      NotificationLevel.All,
      NotificationLevel.Mute,
    ]) {
      await alice.setNotificationLevel(roomId, level);
      expect(await alice.getNotificationLevel(roomId)).toBe(level);
    }
  });

  it('stores mute as an override rule, so mentions are silenced too', async () => {
    // The distinction the whole level mapping exists for: a room-kind rule
    // sits below the mention overrides and leaves them audible.
    const alice = await startSession(ALICE);
    const roomId = await alice.createRoom({ name: 'Push mute shape' });

    await alice.setNotificationLevel(roomId, NotificationLevel.Mute);

    const rules = await alice.getClient().getPushRules();
    expect(rules.global.override?.some((rule) => rule.rule_id === roomId)).toBe(true);
    expect(rules.global.room?.some((rule) => rule.rule_id === roomId)).toBeFalsy();
  });

  it('stores mentions as a room rule, leaving the mention overrides alone', async () => {
    const alice = await startSession(ALICE);
    const roomId = await alice.createRoom({ name: 'Push mentions shape' });

    await alice.setNotificationLevel(roomId, NotificationLevel.Mentions);

    const rules = await alice.getClient().getPushRules();
    expect(rules.global.room?.some((rule) => rule.rule_id === roomId)).toBe(true);
    expect(rules.global.override?.some((rule) => rule.rule_id === roomId)).toBeFalsy();
  });

  it('leaves no rule behind when moving between the quiet levels', async () => {
    // A leftover of the other kind reads as one level in a settings screen
    // while the room behaves as the other.
    const alice = await startSession(ALICE);
    const roomId = await alice.createRoom({ name: 'Push level swap' });

    await alice.setNotificationLevel(roomId, NotificationLevel.Mute);
    await alice.setNotificationLevel(roomId, NotificationLevel.Mentions);

    const rules = await alice.getClient().getPushRules();
    expect(rules.global.override?.some((rule) => rule.rule_id === roomId)).toBeFalsy();
    expect(rules.global.room?.filter((rule) => rule.rule_id === roomId)).toHaveLength(1);
  });
});

describe('what a level actually does', () => {
  /** Sends a message that trips `.m.rule.is_user_mention` for the target. */
  async function mention(
    sender: Awaited<ReturnType<typeof startSession>>,
    roomId: string,
    targetUserId: string,
  ): Promise<string> {
    const response = await sender.getClient().sendMessage(roomId, {
      msgtype: 'm.text',
      body: `${targetUserId}: ping`,
      'm.mentions': { user_ids: [targetUserId] },
    } as never);
    return response.event_id;
  }

  it('lets a mention through at the "mentions" level', async () => {
    // Asserts the outcome, not the shape of the rule. A room-kind rule is
    // evaluated below the mention overrides, and this is what that means.
    const alice = await startSession(ALICE);
    const bob = await startSession(BOB);
    const roomId = await createSharedRoom(alice, bob, { name: 'Mentions audible' });
    await alice.setNotificationLevel(roomId, NotificationLevel.Mentions);

    await mention(bob, roomId, alice.userId);

    await waitFor(
      'the mention to raise a highlight for alice',
      () =>
        (alice.getClient().getRoom(roomId)?.getUnreadNotificationCount('highlight' as never) ?? 0) >
        0,
    );
  });

  it('silences a mention at the "mute" level', async () => {
    // The reason mute has to be an override rule. With the room-kind rule the
    // SDK's own setRoomMutePushRule writes, this count would rise.
    const alice = await startSession(ALICE);
    const bob = await startSession(BOB);
    const roomId = await createSharedRoom(alice, bob, { name: 'Mentions silenced' });
    await alice.setNotificationLevel(roomId, NotificationLevel.Mute);

    const eventId = await mention(bob, roomId, alice.userId);

    // Wait for the event itself to land, so the absence of a highlight is a
    // result rather than a race.
    await waitFor(
      'the mention to reach alice',
      () => Boolean(alice.getClient().getRoom(roomId)?.findEventById(eventId)),
    );

    expect(
      alice.getClient().getRoom(roomId)?.getUnreadNotificationCount('highlight' as never) ?? 0,
    ).toBe(0);
  });
});

describe('resolvePushEvent', () => {
  it('resolves a real push payload without a running session', async () => {
    // This is the background case: the application is woken with two
    // identifiers and no sync loop. The credentials are all it gets.
    const alice = await startSession(ALICE);
    const bob = await startSession(BOB);
    const roomId = await createSharedRoom(alice, bob, { name: 'Push payload' });

    const eventId = await bob.sendText(roomId, 'you have a message');
    await waitFor(
      'the event to be readable back',
      async () => Boolean(await alice.getClient().fetchRoomEvent(roomId, eventId)),
    );

    const credentials = await login(ALICE);
    const notification = await resolvePushEvent(credentials, { roomId, eventId });

    expect(notification.kind).toBe(PushEventKind.Message);
    expect(notification.body).toBe('you have a message');
    expect(notification.roomName).toBe('Push payload');
    expect(notification.senderId).toBe(bob.userId);
    expect(notification.eventId).toBe(eventId);
    expect(notification.ts).toBeGreaterThan(0);
  });

  it('reports an encrypted message as unreadable rather than empty', async () => {
    const alice = await startSession(ALICE, { encrypted: true });
    const bob = await startSession(BOB, { encrypted: true });
    const roomId = await createSharedRoom(alice, bob, { name: 'Push encrypted', encrypted: true });

    const eventId = await bob.sendText(roomId, 'secret');
    await waitFor(
      'the encrypted event to be readable back',
      async () => Boolean(await alice.getClient().fetchRoomEvent(roomId, eventId)),
    );

    const credentials = await login(ALICE);
    const notification = await resolvePushEvent(credentials, { roomId, eventId });

    expect(notification.kind).toBe(PushEventKind.Encrypted);
    expect(notification.body).toBeNull();
    // The room name is still readable, so a host can say which room it was.
    expect(notification.roomName).toBe('Push encrypted');
  });
});
