import { MessageKind } from '../../types/content';
import type { TimelineItem } from '../../types/timeline';
import { TimelineStore } from '../TimelineStore';

const item = (id: string, ts: number, overrides: Partial<TimelineItem> = {}): TimelineItem =>
  ({
    id,
    txnId: null,
    roomId: '!room:example.org',
    sender: '@alice:example.org',
    senderDisplayName: 'Alice',
    senderAvatarMxcUri: null,
    isOwn: false,
    ts,
    kind: MessageKind.Text,
    body: id,
    formattedBody: null,
    media: null,
    location: null,
    replyTo: null,
    thread: null,
    reactions: [],
    isEdited: false,
    editedTs: null,
    isRedacted: false,
    redactedBy: null,
    sendState: null,
    sendError: null,
    wasEncrypted: false,
    ...overrides,
  }) as TimelineItem;

const ids = (store: TimelineStore): string[] => store.getNewestFirst().map((entry) => entry.id);

describe('ordering', () => {
  it('exposes items newest first for an inverted list', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.upsert(item('b', 2000));
    store.upsert(item('c', 3000));

    expect(ids(store)).toEqual(['c', 'b', 'a']);
  });

  it('inserts a late-arriving event at its timestamp position', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.upsert(item('c', 3000));
    store.upsert(item('b', 2000));

    expect(ids(store)).toEqual(['c', 'b', 'a']);
  });

  it('keeps insertion order for events sharing a timestamp', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.upsert(item('b', 1000));
    store.upsert(item('c', 1000));

    expect(ids(store)).toEqual(['c', 'b', 'a']);
  });

  it('prepends a page of history before the loaded window', () => {
    const store = new TimelineStore();
    store.upsert(item('c', 3000));
    store.upsert(item('d', 4000));
    store.prepend([item('a', 1000), item('b', 2000)]);

    expect(ids(store)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('ignores duplicates when a page overlaps what is already loaded', () => {
    const store = new TimelineStore();
    store.upsert(item('b', 2000));
    store.upsert(item('c', 3000));
    store.prepend([item('a', 1000), item('b', 2000)]);

    expect(ids(store)).toEqual(['c', 'b', 'a']);
    expect(store.size).toBe(3);
  });
});

describe('updates', () => {
  it('replaces an existing item in place without reordering', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.upsert(item('b', 2000));
    store.upsert(item('a', 1000, { body: 'edited', isEdited: true }));

    expect(ids(store)).toEqual(['b', 'a']);
    expect(store.getById('a')?.body).toBe('edited');
    expect(store.size).toBe(2);
  });

  it('re-keys a local echo when the homeserver confirms it', () => {
    // Regression: the SDK mutates one MatrixEvent and swaps its ID, so a naive
    // upsert leaves the message rendered twice.
    const store = new TimelineStore();
    store.upsert(item('~txn1', 1000, { txnId: '~txn1', sendState: 'sending' }));
    store.replaceId('~txn1', item('$real', 1000, { txnId: '~txn1', sendState: 'sent' }));

    expect(ids(store)).toEqual(['$real']);
    expect(store.size).toBe(1);
    expect(store.has('~txn1')).toBe(false);
    expect(store.getById('$real')?.sendState).toBe('sent');
  });

  it('falls back to inserting when the local echo is already gone', () => {
    const store = new TimelineStore();
    store.replaceId('~missing', item('$real', 1000));

    expect(ids(store)).toEqual(['$real']);
  });

  it('removes an item and keeps the index consistent', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.upsert(item('b', 2000));
    store.upsert(item('c', 3000));
    store.remove('b');

    expect(ids(store)).toEqual(['c', 'a']);
    expect(store.getById('b')).toBeNull();
    // The surviving entries must still be addressable after the splice.
    expect(store.getById('c')?.id).toBe('c');
    expect(store.getById('a')?.id).toBe('a');
  });

  it('ignores removal of an unknown id', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.remove('nope');

    expect(store.size).toBe(1);
  });

  it('replaces the whole timeline on reset', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    store.reset([item('x', 5000), item('y', 6000)]);

    expect(ids(store)).toEqual(['y', 'x']);
    expect(store.has('a')).toBe(false);
  });
});

describe('cached view', () => {
  it('returns the same array reference until something changes', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));

    const first = store.getNewestFirst();
    expect(store.getNewestFirst()).toBe(first);

    store.upsert(item('b', 2000));
    expect(store.getNewestFirst()).not.toBe(first);
  });

  it('bumps the version on every mutation so hooks can subscribe to it', () => {
    const store = new TimelineStore();
    const start = store.version;

    store.upsert(item('a', 1000));
    store.upsert(item('a', 1000, { body: 'changed' }));
    store.remove('a');

    expect(store.version).toBe(start + 3);
  });

  it('does not bump the version when mapItems changes nothing', () => {
    const store = new TimelineStore();
    store.upsert(item('a', 1000));
    const version = store.version;

    store.mapItems((entry) => entry);
    expect(store.version).toBe(version);

    store.mapItems((entry) => ({ ...entry, senderDisplayName: 'Alice Smith' }));
    expect(store.version).toBe(version + 1);
  });
});
