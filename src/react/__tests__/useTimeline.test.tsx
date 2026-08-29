import { act, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { MatrixProvider } from '../MatrixProvider';
import { createFakeSession, fakeEvent, type FakeSession } from '../testing/fakeSession';
import { useTimeline } from '../useTimeline';

const ROOM_ID = '!room:localhost';

/** Renders one row per timeline item, tagged so several screens can coexist. */
function Screen({ label }: { label: string }): ReactElement {
  const { items, isLoading, hasMore, loadMore } = useTimeline(ROOM_ID);
  return (
    <View>
      <Text testID={`${label}-count`}>{String(items.length)}</Text>
      <Text testID={`${label}-loading`}>{String(isLoading)}</Text>
      <Text testID={`${label}-hasMore`}>{String(hasMore)}</Text>
      <Text testID={`${label}-bodies`}>{items.map((item) => item.body).join(',')}</Text>
      <Text testID={`${label}-reactions`}>
        {items.map((item) => `${item.id}:${item.reactions.map((r) => r.key).join('')}`).join(',')}
      </Text>
      <Text testID={`${label}-myReactionIds`}>
        {items
          .map((item) => item.reactions.map((r) => r.myReactionEventId ?? '-').join(''))
          .join(',')}
      </Text>
      <Text testID={`${label}-loadMore`} onPress={() => void loadMore()}>
        load
      </Text>
    </View>
  );
}

function renderWithSession(fake: FakeSession, children: ReactNode) {
  return render(
    <MatrixProvider
      session={fake.session}
      credentials={{ baseUrl: 'http://localhost:8008', accessToken: 't', userId: '@alice:localhost' }}
    >
      {children}
    </MatrixProvider>,
  );
}

const text = (testID: string): string => screen.getByTestId(testID).props.children as string;

describe('useTimeline', () => {
  it('renders the events already in the room', async () => {
    const fake = createFakeSession({
      events: [
        fakeEvent({ id: '$1', sender: '@bob:localhost', ts: 1000 }),
        fakeEvent({ id: '$2', sender: '@alice:localhost', ts: 2000 }),
      ],
    });
    await renderWithSession(fake, <Screen label="a" />);

    expect(text('a-count')).toBe('2');
    // Newest first, as an inverted list expects.
    expect(text('a-bodies')).toBe('body-$2,body-$1');
  });

  it('appends a live message', async () => {
    const fake = createFakeSession({ events: [] });
    await renderWithSession(fake, <Screen label="a" />);

    await act(async () => {
      const event = fakeEvent({ id: '$new', sender: '@bob:localhost', ts: 5000 });
      fake.room.addEvent(event);
      fake.emitTimeline(event);
    });

    expect(text('a-count')).toBe('1');
  });

  describe('multiple screens on one session', () => {
    // The defect this replaces: 0.0.x stored a single callback slot, so a
    // second chat screen silently stole the first screen's updates, and
    // unmounting either one detached both.
    it('updates every mounted screen showing the same room', async () => {
      const fake = createFakeSession({ events: [] });
      await renderWithSession(
        fake,
        <>
          <Screen label="a" />
          <Screen label="b" />
        </>,
      );

      await act(async () => {
        const event = fakeEvent({ id: '$live', sender: '@bob:localhost', ts: 5000 });
        fake.room.addEvent(event);
        fake.emitTimeline(event);
      });

      expect(text('a-count')).toBe('1');
      expect(text('b-count')).toBe('1');
    });

    it('keeps the surviving screen live after the other unmounts', async () => {
      const fake = createFakeSession({ events: [] });

      function Host(): ReactElement {
        const [showSecond, setShowSecond] = useState(true);
        useEffect(() => {
          const timer = setTimeout(() => setShowSecond(false), 0);
          return () => clearTimeout(timer);
        }, []);
        return (
          <>
            <Screen label="a" />
            {showSecond ? <Screen label="b" /> : null}
          </>
        );
      }

      await renderWithSession(fake, <Host />);
      await act(async () => {
        jest.runAllTimers();
      });
      expect(screen.queryByTestId('b-count')).toBeNull();

      await act(async () => {
        const event = fakeEvent({ id: '$after', sender: '@bob:localhost', ts: 6000 });
        fake.room.addEvent(event);
        fake.emitTimeline(event);
      });

      expect(text('a-count')).toBe('1');
    });
  });

  describe('relations', () => {
    it('folds a reaction onto the message it annotates', async () => {
      const target = fakeEvent({ id: '$target', sender: '@bob:localhost', ts: 1000 });
      const fake = createFakeSession({ events: [target] });
      await renderWithSession(fake, <Screen label="a" />);

      expect(text('a-reactions')).toBe('$target:');

      await act(async () => {
        const reaction = fakeEvent({
          id: '$reaction',
          sender: '@alice:localhost',
          ts: 2000,
          type: 'm.reaction',
          content: {
            'm.relates_to': { rel_type: 'm.annotation', event_id: '$target', key: '👍' },
          },
        });
        fake.room.addReaction(reaction);
        fake.emitTimeline(reaction);
      });

      // The reaction is not a row of its own; it changes the target row.
      expect(text('a-count')).toBe('1');
      expect(text('a-reactions')).toBe('$target:👍');
    });

    it('clears a reaction when the reaction event is redacted', async () => {
      const target = fakeEvent({ id: '$target', sender: '@bob:localhost', ts: 1000 });
      const fake = createFakeSession({ events: [target] });
      await renderWithSession(fake, <Screen label="a" />);

      const reaction = fakeEvent({
        id: '$reaction',
        sender: '@alice:localhost',
        ts: 2000,
        type: 'm.reaction',
        content: {
          'm.relates_to': { rel_type: 'm.annotation', event_id: '$target', key: '👍' },
        },
      });

      await act(async () => {
        fake.room.addReaction(reaction);
        fake.emitTimeline(reaction);
      });
      expect(text('a-reactions')).toBe('$target:👍');

      await act(async () => {
        (reaction as unknown as { __redact: () => void }).__redact();
        // A redaction names the event it removes, and a redacted event has no
        // content left — so nothing in this event points back at `$target`.
        // Rebuilding only the named target left the reaction on screen and the
        // user unable to undo it.
        fake.emitTimeline(
          fakeEvent({
            id: '$redaction',
            sender: '@alice:localhost',
            ts: 3000,
            type: 'm.room.redaction',
            associatedId: '$reaction',
            content: {},
          }),
        );
      });

      expect(text('a-count')).toBe('1');
      expect(text('a-reactions')).toBe('$target:');
    });

    it('re-keys an outgoing reaction when the homeserver confirms it', async () => {
      const target = fakeEvent({ id: '$target', sender: '@bob:localhost', ts: 1000 });
      const fake = createFakeSession({ events: [target] });
      await renderWithSession(fake, <Screen label="a" />);

      const pendingId = `~${ROOM_ID}:txn-reaction`;
      const reaction = fakeEvent({
        id: pendingId,
        txnId: 'txn-reaction',
        sender: '@alice:localhost',
        ts: 2000,
        type: 'm.reaction',
        status: 'sending',
        content: {
          'm.relates_to': { rel_type: 'm.annotation', event_id: '$target', key: '👍' },
        },
      });

      await act(async () => {
        fake.room.addReaction(reaction);
        fake.emitLocalEcho(reaction);
      });
      expect(text('a-reactions')).toBe('$target:👍');
      expect(text('a-myReactionIds')).toBe(pendingId);

      await act(async () => {
        (reaction as unknown as { __confirm: (id: string) => void }).__confirm('$reaction');
        fake.emitLocalEcho(reaction, pendingId);
      });

      // A reaction is a relation, so its echo has to rebuild the row it
      // annotates. Treating it as an unrenderable event left the row holding
      // the provisional ID, which is the ID needed to remove the reaction.
      expect(text('a-myReactionIds')).toBe('$reaction');
    });

    it('does not render an edit as a separate message', async () => {
      const original = fakeEvent({ id: '$original', sender: '@bob:localhost', ts: 1000 });
      const fake = createFakeSession({ events: [original] });
      await renderWithSession(fake, <Screen label="a" />);

      await act(async () => {
        const edit = fakeEvent({
          id: '$edit',
          sender: '@bob:localhost',
          ts: 2000,
          content: {
            msgtype: 'm.text',
            body: '* corrected',
            'm.new_content': { msgtype: 'm.text', body: 'corrected' },
            'm.relates_to': { rel_type: 'm.replace', event_id: '$original' },
          },
        });
        (original as unknown as { __setReplacing: (event: unknown) => void }).__setReplacing(edit);
        fake.emitTimeline(edit);
      });

      expect(text('a-count')).toBe('1');
      expect(text('a-bodies')).toBe('corrected');
    });
  });

  describe('local echo', () => {
    it('re-keys the pending row instead of rendering the message twice', async () => {
      const fake = createFakeSession({ events: [] });
      await renderWithSession(fake, <Screen label="a" />);

      // The SDK keys a pending event as `~<roomId>:<txnId>`, which is not the
      // transaction ID. Modelling the two as equal is what let the real defect
      // through: against a homeserver the row was appended under its confirmed
      // ID and the message stayed on screen twice.
      const pendingId = `~${ROOM_ID}:txn1`;
      const pending = fakeEvent({
        id: pendingId,
        txnId: 'txn1',
        sender: '@alice:localhost',
        ts: 5000,
        status: 'sending',
        content: { msgtype: 'm.text', body: 'hello' },
      });

      await act(async () => {
        fake.room.addEvent(pending);
        fake.emitLocalEcho(pending);
      });
      expect(text('a-count')).toBe('1');

      await act(async () => {
        (pending as unknown as { __confirm: (id: string) => void }).__confirm('$confirmed');
        fake.emitLocalEcho(pending, pendingId);
      });

      expect(text('a-count')).toBe('1');
      expect(text('a-bodies')).toBe('hello');
    });
  });

  describe('pagination', () => {
    it('stops requesting once the start of the room is reached', async () => {
      const fake = createFakeSession({
        events: [fakeEvent({ id: '$1', sender: '@bob:localhost', ts: 1000 })],
      });
      await renderWithSession(fake, <Screen label="a" />);

      expect(text('a-hasMore')).toBe('true');

      await act(async () => {
        screen.getByTestId('a-loadMore').props.onPress();
      });
      await act(async () => {
        screen.getByTestId('a-loadMore').props.onPress();
      });
      await act(async () => {
        screen.getByTestId('a-loadMore').props.onPress();
      });

      // The third call is refused because the second reached the start.
      expect(fake.paginateCalls).toBe(2);
      expect(text('a-hasMore')).toBe('false');
    });
  });
});
