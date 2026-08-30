/**
 * Session and timeline plumbing shared by the integration suites.
 *
 * The helpers here poll for observable state rather than reaching into the
 * SDK's internals, so an assertion reads as "what a consumer would see" — the
 * only thing an integration test is worth running for.
 */

import type { Room } from 'matrix-js-sdk';

import { MatrixSession, type SessionEvents } from '../../src/core/MatrixSession';
import { RoomTimeline } from '../../src/timeline/RoomTimeline';
import type { MatrixAdapters, SyncStorage, TimelineItem, Unsubscribe } from '../../src/types';
import { login, type TestAccount, type TestCredentials } from './homeserver';

const DEFAULT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 100;

const openSessions: MatrixSession[] = [];
const openTimelines: RoomTimeline[] = [];
const observedErrors: Error[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StartSessionOptions {
  /** Events fetched per room on the first sync. Lowered to test pagination. */
  initialSyncLimit?: number;
  /** Initialises the crypto backend. Each login is a distinct device. */
  encrypted?: boolean;
  /** Persists the sync so a later session can resume from it. */
  syncStorage?: SyncStorage;
  /** Reuses credentials instead of logging in again, which issues a new device. */
  credentials?: TestCredentials;
  /** Platform adapters, for the paths that read one. */
  adapters?: MatrixAdapters;
}

/** Logs in and starts a session that has completed its first sync. */
export async function startSession(
  account: TestAccount,
  options: StartSessionOptions = {},
): Promise<MatrixSession> {
  const credentials = options.credentials ?? (await login(account));
  const session = new MatrixSession({
    credentials,
    initialSyncLimit: options.initialSyncLimit ?? 30,
    crypto: options.encrypted ? { enabled: true } : undefined,
    ...(options.syncStorage ? { syncStorage: options.syncStorage } : {}),
    ...(options.adapters ? { adapters: options.adapters } : {}),
    // Background errors are collected instead of thrown: they surface on a
    // sync worker, so a test would otherwise fail as an unexplained timeout.
    onError: (error) => {
      observedErrors.push(error);
    },
  });
  openSessions.push(session);
  await session.start();
  return session;
}

/** Errors reported through `onError` since the suite started. */
export function backgroundErrors(): readonly Error[] {
  return observedErrors;
}

/** Opens a live timeline and registers it for teardown. */
export function openTimeline(session: MatrixSession, roomId: string): RoomTimeline {
  const timeline = new RoomTimeline(session, roomId);
  openTimelines.push(timeline);
  timeline.start();
  return timeline;
}

/**
 * Stops every timeline and session the harness opened.
 *
 * A session left running keeps a long-poll open, and Jest then reports the
 * suite as leaking handles instead of exiting.
 */
export function stopEverything(): void {
  while (openTimelines.length > 0) {
    openTimelines.pop()?.stop();
  }
  while (openSessions.length > 0) {
    openSessions.pop()?.stop();
  }
}

/**
 * Polls `probe` until it returns a truthy value.
 *
 * Anything falsy — including `0` and `''` — counts as "not yet", so probes
 * return the value under test or `null`.
 */
export async function waitFor<T>(
  description: string,
  probe: () => T | null | undefined | false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) {
      return value as T;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Resolves with the first session event matching `predicate`.
 *
 * Subscribe before triggering the action, or a fast homeserver can deliver the
 * event before the listener is attached.
 */
export function waitForSessionEvent<K extends keyof SessionEvents>(
  session: MatrixSession,
  event: K,
  predicate: (payload: SessionEvents[K]) => boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SessionEvents[K]> {
  return new Promise((resolve, reject) => {
    let unsubscribe: Unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for a "${String(event)}" event`));
    }, timeoutMs);

    unsubscribe = session.on(event, (payload) => {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      unsubscribe();
      resolve(payload);
    });
  });
}

/** Waits until a room has synced into the session, e.g. after an invite. */
export function waitForRoom(
  session: MatrixSession,
  roomId: string,
  timeoutMs?: number,
): Promise<Room> {
  return waitFor(
    `room ${roomId} to reach ${session.userId}`,
    () => session.getClient().getRoom(roomId),
    timeoutMs,
  );
}

/** Waits for a timeline row matching `predicate`. */
export function waitForItem(
  timeline: RoomTimeline,
  description: string,
  predicate: (item: TimelineItem) => boolean,
  timeoutMs?: number,
): Promise<TimelineItem> {
  return waitFor(description, () => timeline.getSnapshot().find(predicate) ?? null, timeoutMs);
}

/**
 * Creates a room owned by `host`, invites `guest`, and waits for the join to
 * be visible on both sides.
 *
 * Each suite makes its own room. Sharing one across files would make the tests
 * order-dependent — read receipts in particular are per-room state that an
 * earlier test would already have advanced.
 */
export async function createSharedRoom(
  host: MatrixSession,
  guest: MatrixSession,
  options: { name: string; encrypted?: boolean },
): Promise<string> {
  const roomId = await host.createRoom({
    name: options.name,
    invite: [guest.userId],
    encrypted: options.encrypted,
  });

  await waitForRoom(guest, roomId);
  await guest.joinRoom(roomId);

  await waitFor(
    `${guest.userId} to be joined to ${roomId}`,
    () => guest.getClient().getRoom(roomId)?.getMyMembership() === 'join',
  );
  // The host must observe the join too: a message sent before the membership
  // lands can be rejected for the guest and never reaches their timeline.
  await waitFor(
    `${host.userId} to see ${guest.userId} join`,
    () => host.getClient().getRoom(roomId)?.getMember(guest.userId)?.membership === 'join',
  );

  return roomId;
}
