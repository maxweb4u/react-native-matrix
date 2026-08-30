import { type ISyncResponse, MemoryStore, SyncAccumulator } from 'matrix-js-sdk';

import type { SyncStorage } from '../types/session';

/**
 * A client store that survives a relaunch by writing the accumulated `/sync`
 * response to host-supplied storage.
 *
 * Without one of these, every cold start is a full initial sync: the client
 * asks for the last `initialSyncLimit` events of every room and waits for the
 * homeserver to build that response. With one, it resumes from the saved
 * `next_batch` token and the first render comes from local data.
 *
 * The SDK ships `IndexedDBStore` for exactly this, and React Native has no
 * IndexedDB. Rather than ask hosts to polyfill a whole database, this
 * subclasses `MemoryStore` the same way `IndexedDBStore` does and persists
 * through a two-method key/value interface that `AsyncStorage`, MMKV and
 * `expo-secure-store` all already satisfy.
 *
 * See memory_bank/domain/sync.md#persistence.
 */

/** Bumped when the stored shape changes; an older payload is discarded, not migrated. */
const STORAGE_VERSION = 1;

/**
 * How long to wait between writes.
 *
 * The whole accumulated sync is serialised on every write, so this is the
 * trade-off between a long pause on the JS thread and a larger `/sync` to
 * catch up on after a relaunch. The SDK's IndexedDB backend uses the same five
 * minutes for the same reason.
 */
const DEFAULT_WRITE_DELAY_MS = 5 * 60 * 1000;

interface StoredSync {
  version: number;
  nextBatch: string;
  roomsData: unknown;
  accountData: unknown;
}

export interface PersistentSyncStoreOptions {
  /** Key/value storage supplied by the host. */
  storage: SyncStorage;
  /** Storage key. Defaults to `react-native-matrix:sync`. */
  key?: string;
  /** Minimum interval between writes. Defaults to five minutes. */
  writeDelayMs?: number;
  /**
   * Called when a read or write fails. Defaults to a no-op.
   *
   * Storage failures never propagate: a full sync is a slow start, but a
   * throw here would take down a session that is otherwise working.
   */
  onError?: (error: Error) => void;
}

export class PersistentSyncStore extends MemoryStore {
  private readonly accumulator = new SyncAccumulator();

  private readonly storage: SyncStorage;

  private readonly key: string;

  private readonly writeDelayMs: number;

  private readonly onError: (error: Error) => void;

  private dirty = false;

  /**
   * Start of the current write window.
   *
   * Seeded in the constructor rather than left at 0, so the first write lands
   * one delay after launch. At 0 the store would want to save on the very
   * first sync response, putting the largest serialisation of the run exactly
   * where a cold start can least afford a pause on the JS thread.
   */
  private lastSavedAt: number;

  private restored = false;

  public constructor(options: PersistentSyncStoreOptions) {
    super({});
    this.storage = options.storage;
    this.key = options.key ?? 'react-native-matrix:sync';
    this.writeDelayMs = options.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS;
    this.onError = options.onError ?? (() => {});
    this.lastSavedAt = Date.now();
  }

  /** True when no usable saved sync was found, so this start is a full one. */
  public override isNewlyCreated(): Promise<boolean> {
    return Promise.resolve(!this.restored);
  }

  /** Reads the saved sync back into the accumulator. Called once by the SDK. */
  public override async startup(): Promise<void> {
    const raw = await this.read();
    if (!raw) {
      return;
    }
    // `fromDatabase` tells the accumulator these events are already-persisted
    // history rather than a live response, which keeps it from re-deriving
    // timestamps it has no basis for.
    this.accumulator.accumulate(
      {
        next_batch: raw.nextBatch,
        rooms: raw.roomsData,
        account_data: { events: raw.accountData },
      } as unknown as ISyncResponse,
      true,
    );
    this.restored = true;
    this.lastSavedAt = Date.now();
  }

  public override setSyncData(syncData: ISyncResponse): Promise<void> {
    this.accumulator.accumulate(syncData);
    this.dirty = true;
    return Promise.resolve();
  }

  public override wantsSave(): boolean {
    return this.dirty && Date.now() - this.lastSavedAt >= this.writeDelayMs;
  }

  public override async save(force = false): Promise<void> {
    if (!force && !this.wantsSave()) {
      return;
    }
    const data = this.accumulator.getJSON(true);
    if (!data.nextBatch) {
      return;
    }
    const payload: StoredSync = {
      version: STORAGE_VERSION,
      nextBatch: data.nextBatch,
      roomsData: data.roomsData,
      accountData: data.accountData,
    };
    try {
      await this.storage.setItem(this.key, JSON.stringify(payload));
      this.dirty = false;
      this.lastSavedAt = Date.now();
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public override getSavedSync(): Promise<never> {
    const data = this.accumulator.getJSON();
    if (!data.nextBatch) {
      return Promise.resolve(null as never);
    }
    // The sync processing code annotates what it is given with non-clonable
    // keys, so it must not receive the accumulator's own objects.
    return Promise.resolve(JSON.parse(JSON.stringify(data)) as never);
  }

  public override getSavedSyncToken(): Promise<string | null> {
    return Promise.resolve(this.accumulator.getNextBatchToken() || null);
  }

  public override async deleteAllData(): Promise<void> {
    try {
      await this.storage.removeItem(this.key);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
    this.dirty = false;
    this.restored = false;
    await super.deleteAllData();
  }

  /** Reads and validates the stored payload. Anything unusable is discarded. */
  private async read(): Promise<StoredSync | null> {
    let serialised: string | null;
    try {
      serialised = await this.storage.getItem(this.key);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
    if (!serialised) {
      return null;
    }
    try {
      const parsed = JSON.parse(serialised) as StoredSync;
      // A payload from an older library version, or a half-written one, means
      // a full sync — never a crash on a user's device at startup.
      if (parsed?.version !== STORAGE_VERSION || typeof parsed.nextBatch !== 'string') {
        return null;
      }
      return parsed;
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }
}
