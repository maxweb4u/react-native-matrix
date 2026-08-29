/**
 * Sending, receiving, editing, redacting, replying, and reacting across two
 * users on a real homeserver.
 *
 * These are the behaviours a mock would have to invent, so they live here
 * rather than in the unit suite. See
 * memory_bank/engineering/testing-policy.md#what-integration-tests-own.
 */

import type { MatrixSession } from '../src/core/MatrixSession';
import type { RoomTimeline } from '../src/timeline/RoomTimeline';
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

let alice: MatrixSession;
let bob: MatrixSession;
let roomId: string;
let aliceTimeline: RoomTimeline;
let bobTimeline: RoomTimeline;

beforeAll(async () => {
  await requireHomeserver();
  [alice, bob] = await Promise.all([startSession(ALICE), startSession(BOB)]);
  roomId = await createSharedRoom(alice, bob, { name: 'Messaging' });
  aliceTimeline = openTimeline(alice, roomId);
  bobTimeline = openTimeline(bob, roomId);
});

afterAll(() => {
  stopEverything();
});

describe('text messages', () => {
  it('delivers a message to the other participant', async () => {
    const eventId = await alice.sendText(roomId, 'hello from alice');

    const received = await waitForItem(
      bobTimeline,
      'bob to receive the message',
      (item) => item.id === eventId,
    );

    expect(received.body).toBe('hello from alice');
    expect(received.sender).toBe(ALICE.userId);
    expect(received.isOwn).toBe(false);
    expect(received.kind).toBe(MessageKind.Text);
    expect(received.isRedacted).toBe(false);
    expect(received.isEdited).toBe(false);
  });

  it('re-keys the local echo rather than rendering the message twice', async () => {
    const body = `echo ${Date.now()}`;
    const eventId = await alice.sendText(roomId, body);

    await waitForItem(
      aliceTimeline,
      'the confirmed event on the sender timeline',
      (item) => item.id === eventId,
    );

    // SC-7. The SDK reuses the echo's event object and swaps its ID on
    // confirmation, so a store keyed by ID has to re-key the existing row.
    // Appending instead leaves the message on screen twice.
    const matching = aliceTimeline.getSnapshot().filter((item) => item.body === body);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.isOwn).toBe(true);
  });
});

describe('edits', () => {
  it('replaces the body in place instead of adding a row', async () => {
    const original = await alice.sendText(roomId, 'typo hre');
    await waitForItem(bobTimeline, 'the original message', (item) => item.id === original);

    await alice.editText(roomId, original, 'typo here');

    const edited = await waitFor('bob to see the edit', () => {
      const item = bobTimeline.getSnapshot().find((candidate) => candidate.id === original);
      return item?.isEdited ? item : null;
    });

    expect(edited.body).toBe('typo here');
    expect(edited.editedTs).not.toBeNull();
    // The `* typo here` fallback body of the replacement event must never
    // become a row of its own.
    expect(bobTimeline.getSnapshot().some((item) => item.body === '* typo here')).toBe(false);
    expect(bobTimeline.getSnapshot().filter((item) => item.body === 'typo here')).toHaveLength(1);
  });
});

describe('redactions', () => {
  it('turns the message into a tombstone for both participants', async () => {
    const target = await alice.sendText(roomId, 'delete me');
    await waitForItem(bobTimeline, 'the message to delete', (item) => item.id === target);

    await alice.redact(roomId, target, 'integration test');

    const redacted = await waitFor('bob to see the redaction', () => {
      const item = bobTimeline.getSnapshot().find((candidate) => candidate.id === target);
      return item?.isRedacted ? item : null;
    });

    expect(redacted.kind).toBe(MessageKind.Redacted);
    expect(redacted.body).toBe('');
    expect(redacted.redactedBy).toBe(ALICE.userId);
    // The row keeps its position rather than vanishing, so the conversation
    // does not jump under the reader.
    expect(aliceTimeline.getSnapshot().some((item) => item.id === target)).toBe(true);
  });
});

describe('reactions', () => {
  it('aggregates and removes a reaction on both sides', async () => {
    const target = await alice.sendText(roomId, 'react to me');
    await waitForItem(bobTimeline, 'the message to react to', (item) => item.id === target);

    const reactionId = await bob.react(roomId, target, '👍');

    // 0.0.x tracked one hard-coded `liked` key in component state and had no
    // way to remove a reaction, so nothing about this round-trip worked.
    const asSeenByAlice = await waitFor('alice to see the reaction', () => {
      const item = aliceTimeline.getSnapshot().find((candidate) => candidate.id === target);
      return item && item.reactions.length > 0 ? item : null;
    });
    expect(asSeenByAlice.reactions[0]).toMatchObject({
      key: '👍',
      count: 1,
      senders: [BOB.userId],
      reactedByMe: false,
    });

    const asSeenByBob = await waitFor('bob to see his own reaction', () => {
      const item = bobTimeline.getSnapshot().find((candidate) => candidate.id === target);
      return item?.reactions[0]?.reactedByMe ? item : null;
    });
    // The ID is what makes the reaction removable at all.
    expect(asSeenByBob.reactions[0]?.myReactionEventId).toBe(reactionId);

    await bob.unreact(roomId, reactionId);

    await waitFor(
      'the reaction to disappear for alice',
      () =>
        aliceTimeline.getSnapshot().find((item) => item.id === target)?.reactions.length === 0,
    );
  });
});

describe('replies', () => {
  it('carries a resolved reference to the quoted message', async () => {
    const target = await alice.sendText(roomId, 'the question');
    await waitForItem(bobTimeline, 'the message to reply to', (item) => item.id === target);

    const replyId = await bob.sendText(roomId, 'the answer', { replyToEventId: target });

    const reply = await waitForItem(
      aliceTimeline,
      'alice to receive the reply',
      (item) => item.id === replyId,
    );

    expect(reply.replyTo).toMatchObject({
      eventId: target,
      sender: ALICE.userId,
      body: 'the question',
    });
    // The plain-text fallback (`> <@alice> the question`) is stripped, so the
    // quote is not rendered twice.
    expect(reply.body).toBe('the answer');
  });
});
