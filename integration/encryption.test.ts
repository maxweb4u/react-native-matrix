/**
 * An encrypted room, end to end, between two devices.
 *
 * SC-9. Nothing short of two real devices against a real homeserver proves
 * this: the room key has to be created by one device, shared over to-device
 * messages, and used by the other. A mock would be asserting its own
 * assumptions.
 *
 * See memory_bank/domain/encryption.md.
 */

import type { MatrixSession } from '../src/core/MatrixSession';
import type { RoomTimeline } from '../src/timeline/RoomTimeline';
import { enableRoomEncryption } from '../src/crypto';
import { MessageKind } from '../src/types/content';
import { ALICE, BOB, requireHomeserver } from './support/homeserver';
import {
  createSharedRoom,
  openTimeline,
  startSession,
  stopEverything,
  waitFor,
  waitForItem,
} from './support/harness';

/** Key exchange adds a round of to-device traffic on top of the send. */
const CRYPTO_TIMEOUT_MS = 40_000;

let alice: MatrixSession;
let bob: MatrixSession;
let roomId: string;
let aliceTimeline: RoomTimeline;
let bobTimeline: RoomTimeline;

beforeAll(async () => {
  await requireHomeserver();
  [alice, bob] = await Promise.all([
    startSession(ALICE, { encrypted: true }),
    startSession(BOB, { encrypted: true }),
  ]);
  roomId = await createSharedRoom(alice, bob, { name: 'Encrypted', encrypted: true });
  aliceTimeline = openTimeline(alice, roomId);
  bobTimeline = openTimeline(bob, roomId);
}, 120_000);

afterAll(() => {
  stopEverything();
});

describe('an encrypted room', () => {
  it('reports crypto as enabled on both sessions', () => {
    expect(alice.getStatus().isCryptoEnabled).toBe(true);
    expect(bob.getStatus().isCryptoEnabled).toBe(true);
  });

  it('is marked encrypted for both participants', () => {
    expect(alice.isRoomEncrypted(roomId)).toBe(true);
    expect(bob.isRoomEncrypted(roomId)).toBe(true);
  });

  it('delivers a message the other device can decrypt', async () => {
    const eventId = await alice.sendText(roomId, 'encrypted hello');

    const received = await waitForItem(
      bobTimeline,
      'bob to decrypt the message',
      (item) => item.id === eventId && item.kind === MessageKind.Text,
      CRYPTO_TIMEOUT_MS,
    );

    expect(received.body).toBe('encrypted hello');
    expect(received.wasEncrypted).toBe(true);
    // The whole point: an encrypted room must not render as a wall of
    // placeholders. 0.0.x filtered out every event without a plain-text body,
    // so an encrypted room simply appeared empty.
    expect(received.kind).not.toBe(MessageKind.UndecryptableEncrypted);
  }, CRYPTO_TIMEOUT_MS);

  it('decrypts in the other direction too', async () => {
    const eventId = await bob.sendText(roomId, 'encrypted reply');

    const received = await waitForItem(
      aliceTimeline,
      'alice to decrypt the reply',
      (item) => item.id === eventId && item.kind === MessageKind.Text,
      CRYPTO_TIMEOUT_MS,
    );

    expect(received.body).toBe('encrypted reply');
    expect(received.wasEncrypted).toBe(true);
  }, CRYPTO_TIMEOUT_MS);

  it('redacts an encrypted message', async () => {
    const target = await alice.sendText(roomId, 'delete this encrypted message');
    await waitForItem(
      bobTimeline,
      'bob to decrypt the message to delete',
      (item) => item.id === target && item.kind === MessageKind.Text,
      CRYPTO_TIMEOUT_MS,
    );

    await alice.redact(roomId, target);

    const redacted = await waitFor(
      'bob to see the redaction',
      () => {
        const item = bobTimeline.getSnapshot().find((candidate) => candidate.id === target);
        return item?.isRedacted ? item : null;
      },
      CRYPTO_TIMEOUT_MS,
    );

    expect(redacted.kind).toBe(MessageKind.Redacted);
    expect(redacted.body).toBe('');
  }, CRYPTO_TIMEOUT_MS);
});

describe('enableRoomEncryption', () => {
  it('turns on encryption for a room that started unencrypted', async () => {
    const plainRoomId = await createSharedRoom(alice, bob, { name: 'Upgraded' });
    expect(alice.isRoomEncrypted(plainRoomId)).toBe(false);

    await enableRoomEncryption(alice, plainRoomId);

    await waitFor(
      'the room to become encrypted for alice',
      () => alice.isRoomEncrypted(plainRoomId),
      CRYPTO_TIMEOUT_MS,
    );
    await waitFor(
      'the room to become encrypted for bob',
      () => bob.isRoomEncrypted(plainRoomId),
      CRYPTO_TIMEOUT_MS,
    );

    // Idempotent: a second call must not write another state event.
    await expect(enableRoomEncryption(alice, plainRoomId)).resolves.toBeUndefined();
  }, CRYPTO_TIMEOUT_MS);
});
