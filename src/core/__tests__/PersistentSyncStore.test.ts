import type { ISyncResponse } from 'matrix-js-sdk';

import { PersistentSyncStore } from '../PersistentSyncStore';
import type { SyncStorage } from '../../types/session';

/** An in-memory stand-in for AsyncStorage, with the failure modes it has. */
function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    failOn: null as null | 'get' | 'set' | 'remove',
    async getItem(key: string) {
      if (this.failOn === 'get') throw new Error('storage unavailable');
      return items.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      if (this.failOn === 'set') throw new Error('disk full');
      items.set(key, value);
    },
    async removeItem(key: string) {
      if (this.failOn === 'remove') throw new Error('storage unavailable');
      items.delete(key);
    },
  };
}

/** The smallest response the accumulator treats as a real sync. */
function syncResponse(nextBatch: string): ISyncResponse {
  return {
    next_batch: nextBatch,
    rooms: { join: {}, invite: {}, leave: {}, knock: {} },
    account_data: { events: [] },
  } as unknown as ISyncResponse;
}

const KEY = 'react-native-matrix:sync';

describe('persisting', () => {
  it('writes the sync token so the next launch can resume', async () => {
    const storage = fakeStorage();
    const store = new PersistentSyncStore({ storage });

    await store.setSyncData(syncResponse('s72_1'));
    await store.save(true);

    expect(JSON.parse(storage.items.get(KEY)!).nextBatch).toBe('s72_1');
  });

  it('restores the token on startup', async () => {
    const storage = fakeStorage();
    const first = new PersistentSyncStore({ storage });
    await first.setSyncData(syncResponse('s72_1'));
    await first.save(true);

    const second = new PersistentSyncStore({ storage });
    await second.startup();

    expect(await second.getSavedSyncToken()).toBe('s72_1');
    expect(await second.isNewlyCreated()).toBe(false);
  });

  it('reports a fresh start when storage holds nothing', async () => {
    const store = new PersistentSyncStore({ storage: fakeStorage() });
    await store.startup();

    expect(await store.isNewlyCreated()).toBe(true);
    expect(await store.getSavedSyncToken()).toBeNull();
  });

  it('honours a custom storage key', async () => {
    const storage = fakeStorage();
    const store = new PersistentSyncStore({ storage, key: 'app:matrix' });

    await store.setSyncData(syncResponse('s1'));
    await store.save(true);

    expect(storage.items.has('app:matrix')).toBe(true);
    expect(storage.items.has(KEY)).toBe(false);
  });

  it('does not write before there is a token to write', async () => {
    const storage = fakeStorage();
    const store = new PersistentSyncStore({ storage });

    await store.save(true);

    expect(storage.items.size).toBe(0);
  });
});

describe('write scheduling', () => {
  it('does not want to save before the delay elapses', async () => {
    const store = new PersistentSyncStore({ storage: fakeStorage(), writeDelayMs: 60_000 });
    await store.startup();
    await store.setSyncData(syncResponse('s1'));

    expect(store.wantsSave()).toBe(false);
  });

  it('wants to save once the delay has passed', async () => {
    const store = new PersistentSyncStore({ storage: fakeStorage(), writeDelayMs: 1_000 });
    await store.startup();
    await store.setSyncData(syncResponse('s1'));

    jest.advanceTimersByTime(2_000);

    expect(store.wantsSave()).toBe(true);
  });

  it('never wants to save when nothing changed since the last write', async () => {
    const store = new PersistentSyncStore({ storage: fakeStorage(), writeDelayMs: 1_000 });
    await store.setSyncData(syncResponse('s1'));
    await store.save(true);

    jest.advanceTimersByTime(10_000);

    expect(store.wantsSave()).toBe(false);
  });

  it('skips an unforced save that is not due yet', async () => {
    const storage = fakeStorage();
    const store = new PersistentSyncStore({ storage, writeDelayMs: 60_000 });
    await store.setSyncData(syncResponse('s1'));

    await store.save();

    expect(storage.items.size).toBe(0);
  });
});

describe('recovering from bad stored data', () => {
  it('discards a payload written by an older version', async () => {
    const storage = fakeStorage({
      [KEY]: JSON.stringify({ version: 0, nextBatch: 's1', roomsData: {}, accountData: [] }),
    });
    const store = new PersistentSyncStore({ storage });

    await store.startup();

    // A full sync is the correct outcome here. Migrating a shape this library
    // no longer understands would be guesswork on a user's device.
    expect(await store.isNewlyCreated()).toBe(true);
  });

  it('discards a truncated payload rather than throwing at startup', async () => {
    const storage = fakeStorage({ [KEY]: '{"version":1,"nextBatch":' });
    const errors: Error[] = [];
    const store = new PersistentSyncStore({ storage, onError: (e) => errors.push(e) });

    await expect(store.startup()).resolves.toBeUndefined();
    expect(await store.isNewlyCreated()).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it('discards a payload with no token', async () => {
    const storage = fakeStorage({
      [KEY]: JSON.stringify({ version: 1, roomsData: {}, accountData: [] }),
    });
    const store = new PersistentSyncStore({ storage });

    await store.startup();

    expect(await store.isNewlyCreated()).toBe(true);
  });
});

describe('storage failures', () => {
  it('reports a failed read and starts fresh', async () => {
    const storage = fakeStorage();
    storage.failOn = 'get';
    const errors: Error[] = [];
    const store = new PersistentSyncStore({ storage, onError: (e) => errors.push(e) });

    await expect(store.startup()).resolves.toBeUndefined();
    expect(errors[0]?.message).toBe('storage unavailable');
  });

  it('reports a failed write without throwing into the sync loop', async () => {
    const storage = fakeStorage();
    storage.failOn = 'set';
    const errors: Error[] = [];
    const store = new PersistentSyncStore({ storage, onError: (e) => errors.push(e) });
    await store.setSyncData(syncResponse('s1'));

    await expect(store.save(true)).resolves.toBeUndefined();
    expect(errors[0]?.message).toBe('disk full');
  });

  it('keeps the data dirty after a failed write, so the next one retries', async () => {
    const storage = fakeStorage();
    storage.failOn = 'set';
    const store = new PersistentSyncStore({ storage, writeDelayMs: 0 });
    await store.setSyncData(syncResponse('s1'));
    await store.save(true);

    storage.failOn = null;
    await store.save(true);

    expect(JSON.parse(storage.items.get(KEY)!).nextBatch).toBe('s1');
  });
});

describe('deleteAllData', () => {
  it('removes the stored sync so another account cannot resume from it', async () => {
    const storage = fakeStorage();
    const store = new PersistentSyncStore({ storage });
    await store.setSyncData(syncResponse('s1'));
    await store.save(true);

    await store.deleteAllData();

    expect(storage.items.size).toBe(0);
    expect(await store.isNewlyCreated()).toBe(true);
  });

  it('reports a failed removal instead of throwing', async () => {
    const storage = fakeStorage();
    const store = new PersistentSyncStore({ storage });
    await store.setSyncData(syncResponse('s1'));
    await store.save(true);
    storage.failOn = 'remove';
    const errors: Error[] = [];
    const reporting = new PersistentSyncStore({ storage, onError: (e) => errors.push(e) });

    await expect(reporting.deleteAllData()).resolves.toBeUndefined();
    expect(errors[0]?.message).toBe('storage unavailable');
  });
});

describe('getSavedSync', () => {
  it('returns null before anything has been synced', async () => {
    const store = new PersistentSyncStore({ storage: fakeStorage() });

    expect(await store.getSavedSync()).toBeNull();
  });

  it('hands out a copy, not the accumulator’s own objects', async () => {
    const store = new PersistentSyncStore({ storage: fakeStorage() });
    await store.setSyncData(syncResponse('s1'));

    const first = await store.getSavedSync();
    const second = await store.getSavedSync();

    // The SDK annotates what it receives with non-clonable keys, so handing
    // out the internal object twice would corrupt the accumulator.
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

/** A SyncStorage-typed value compiles from the fake, proving the shape is right. */
it('accepts any object with the three storage methods', () => {
  const storage: SyncStorage = fakeStorage();

  expect(() => new PersistentSyncStore({ storage })).not.toThrow();
});
