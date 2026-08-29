import type { MatrixAdapters } from './adapters';

/** Credentials for an already authenticated user. */
export interface SessionCredentials {
  /** Homeserver base URL, e.g. `https://matrix.example.org`. */
  baseUrl: string;
  accessToken: string;
  userId: string;
  /**
   * Device ID issued at login. Required for end-to-end encryption; without it
   * the crypto layer cannot be initialised.
   */
  deviceId?: string;
}

export interface CryptoOptions {
  /**
   * Enables end-to-end encryption. Requires the optional peer dependency
   * `@matrix-org/matrix-sdk-crypto-wasm` and a JS engine with WebAssembly
   * support. Stock React Native has none as of 0.87, so this needs a
   * WebAssembly-capable engine or a polyfill.
   */
  enabled: boolean;
  /**
   * 32-byte key used to encrypt the local crypto store. Strongly recommended:
   * without it the store holds room keys in the clear.
   *
   * Only meaningful together with `useIndexedDB`; an in-memory store is never
   * written anywhere to encrypt.
   */
  storageKey?: Uint8Array;
  /**
   * Persists room keys in IndexedDB.
   *
   * Defaults to whether the engine has an `indexedDB` global. React Native
   * does not, so unless the host installs a polyfill the crypto store is held
   * in memory: room keys are re-established on every launch, and encrypted
   * messages received before the current launch cannot be decrypted. Set this
   * to `true` explicitly once a polyfill is in place.
   *
   * See memory_bank/domain/encryption.md#key-persistence.
   */
  useIndexedDB?: boolean;
}

/**
 * Key/value storage the session persists its sync state to.
 *
 * Deliberately the smallest interface that does the job, because the library
 * has no runtime dependencies and cannot pick a storage package for the host.
 * `@react-native-async-storage/async-storage` satisfies it as-is; MMKV and
 * `expo-secure-store` need a three-line wrapper.
 *
 * ```ts
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * new MatrixSession({ credentials, syncStorage: AsyncStorage });
 * ```
 */
export interface SyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SyncPersistenceOptions {
  /** Storage key. Defaults to `react-native-matrix:sync`. */
  key?: string;
  /**
   * Minimum interval between writes, in milliseconds. Defaults to 300000.
   *
   * The whole accumulated sync is serialised on each write, so lowering this
   * trades a longer pause on the JS thread for less to catch up on after a
   * relaunch.
   */
  writeDelayMs?: number;
}

export interface SessionOptions {
  credentials: SessionCredentials;
  /**
   * Persists the sync token and accumulated room state, so a relaunch resumes
   * from where the last run stopped instead of running a full initial sync.
   *
   * Omit it and the session keeps everything in memory, which is the default:
   * correct, but every cold start pays for a full `/sync`.
   *
   * See memory_bank/domain/sync.md#persistence.
   */
  syncStorage?: SyncStorage;
  /** Tuning for `syncStorage`. Ignored when no storage is supplied. */
  syncPersistence?: SyncPersistenceOptions;
  /** Number of events fetched per room on the first sync. Defaults to 20. */
  initialSyncLimit?: number;
  /** Long-poll timeout in milliseconds passed to `/sync`. Defaults to 30000. */
  pollTimeoutMs?: number;
  crypto?: CryptoOptions;
  adapters?: MatrixAdapters;
  /**
   * Called for errors that surface outside a caller's promise, such as a
   * failed background sync. Defaults to a no-op.
   */
  onError?: (error: Error) => void;
}

export const SyncState = {
  /** No sync has completed yet. */
  Initial: 'initial',
  Syncing: 'syncing',
  /** Connection lost; the client retries in the background. */
  Reconnecting: 'reconnecting',
  Error: 'error',
  Stopped: 'stopped',
} as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];

export interface SessionStatus {
  syncState: SyncState;
  /** True once the first sync completed and room data is usable. */
  isReady: boolean;
  /** Total unread notification count across all joined rooms. */
  totalUnread: number;
  /** Last error surfaced by the sync loop, if any. */
  error: Error | null;
  /** True when the crypto layer is initialised and usable. */
  isCryptoEnabled: boolean;
}

/** Removes a previously registered listener. */
export type Unsubscribe = () => void;
