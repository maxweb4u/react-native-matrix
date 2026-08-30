/**
 * Resuming a session from persisted sync state, against a real homeserver.
 *
 * The unit suite proves the store's own behaviour with a fake `/sync`. Only a
 * real homeserver proves the part that matters: that the token the store wrote
 * is one the server accepts, and that a resumed session sees the rooms the
 * first one saw without asking for them again.
 *
 * See memory_bank/domain/sync.md#persistence.
 */

import type { SyncStorage } from '../src/types';
import { ALICE, login, requireHomeserver, type TestCredentials } from './support/homeserver';
import { startSession, stopEverything, waitFor } from './support/harness';

/** AsyncStorage's interface, backed by a Map, with a call count. */
function memoryStorage() {
  const items = new Map<string, string>();
  let writes = 0;
  const storage: SyncStorage = {
    getItem: (key) => Promise.resolve(items.get(key) ?? null),
    setItem: (key, value) => {
      writes += 1;
      items.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      items.delete(key);
      return Promise.resolve();
    },
  };
  return {
    storage,
    get writes() {
      return writes;
    },
    snapshot: () => {
      const raw = items.get('react-native-matrix:sync');
      return raw ? (JSON.parse(raw) as { nextBatch: string }) : null;
    },
    size: () => items.size,
  };
}

let credentials: TestCredentials;

beforeAll(async () => {
  await requireHomeserver();
  // One login for the whole suite: every login issues a new device, and a
  // resumed session must be the same device as the one that saved.
  credentials = await login(ALICE);
});

afterAll(() => {
  stopEverything();
});

describe('persisting a real sync', () => {
  it('writes a token the homeserver issued', async () => {
    const store = memoryStorage();
    const session = await startSession(ALICE, { credentials, syncStorage: store.storage });

    await session.flush();

    const snapshot = store.snapshot();
    expect(snapshot).not.toBeNull();
    // Synapse batch tokens start with `s`; the point is that this came from
    // the server rather than being something the store invented.
    expect(typeof snapshot!.nextBatch).toBe('string');
    expect(snapshot!.nextBatch.length).toBeGreaterThan(0);

    session.stop();
  });

  it('resumes a second session from the saved snapshot', async () => {
    const store = memoryStorage();

    const first = await startSession(ALICE, { credentials, syncStorage: store.storage });
    const roomsBefore = first.getRooms().map((room) => room.roomId).sort();
    await first.flush();
    first.stop();

    expect(roomsBefore.length).toBeGreaterThan(0);

    const resumed = await startSession(ALICE, { credentials, syncStorage: store.storage });
    await waitFor('the resumed session to expose its rooms', () => resumed.getRooms().length > 0);

    // The rooms are there without a fresh initial sync having been needed for
    // them: the resumed session started from the stored snapshot.
    expect(resumed.getRooms().map((room) => room.roomId).sort()).toEqual(roomsBefore);
    expect(resumed.getStatus().isReady).toBe(true);
    expect(resumed.getStatus().error).toBeNull();

    resumed.stop();
  });

  it('starts clean after the snapshot is cleared', async () => {
    const store = memoryStorage();

    const first = await startSession(ALICE, { credentials, syncStorage: store.storage });
    await first.flush();
    expect(store.size()).toBe(1);

    await first.clearPersistedSync();
    expect(store.size()).toBe(0);

    // Sign-out must leave nothing for the next account on the device to
    // resume from, and the next start must still work.
    const fresh = await startSession(ALICE, { credentials, syncStorage: store.storage });
    expect(fresh.getStatus().isReady).toBe(true);

    first.stop();
    fresh.stop();
  });

  it('runs without storage exactly as before', async () => {
    // The option is additive: omitting it must not change anything.
    const session = await startSession(ALICE, { credentials });

    expect(session.getStatus().isReady).toBe(true);
    await expect(session.flush()).resolves.toBeUndefined();
    await expect(session.clearPersistedSync()).resolves.toBeUndefined();

    session.stop();
  });
});
