import { EventType, type MatrixEvent, type Room } from 'matrix-js-sdk';

import type { MatrixSession } from '../core/MatrixSession';
import type { TimelineItem } from '../types/timeline';
import type { Unsubscribe } from '../types/session';
import { buildTimelineItem, isRenderableEvent } from './buildTimelineItem';
import { parseRelation } from './parseContent';
import { TimelineStore } from './TimelineStore';

/**
 * Live view of one room's conversation.
 *
 * One instance exists per open room, shared by every hook observing it. It
 * translates SDK events into store mutations, rebuilding only the rows that an
 * event actually affects: a reaction rebuilds its target, an edit rebuilds the
 * edited message, and an ordinary message appends a single row.
 *
 * 0.0.x reconstructed the whole room model — every event and content object —
 * on each incoming sync event.
 *
 * See memory_bank/engineering/architecture.md#update-flow.
 */
export class RoomTimeline {
  private readonly store = new TimelineStore();

  private readonly listeners = new Set<() => void>();

  private readonly detachers: Unsubscribe[] = [];

  private paginating = false;

  private reachedStart = false;

  public constructor(
    private readonly session: MatrixSession,
    public readonly roomId: string,
  ) {}

  // ------------------------------------------------------------------ lifecycle

  /** Loads the currently synced window and starts following live updates. */
  public start(): void {
    this.hydrate();

    this.detachers.push(
      this.session.on('timeline', ({ roomId, event }) => {
        if (roomId === this.roomId) {
          this.applyEvent(event);
        }
      }),
      this.session.on('localEcho', ({ roomId, event, previousEventId }) => {
        if (roomId === this.roomId) {
          this.applyLocalEcho(event, previousEventId);
        }
      }),
      this.session.on('receipt', ({ roomId }) => {
        if (roomId === this.roomId) {
          this.notify();
        }
      }),
    );
  }

  public stop(): void {
    for (const detach of this.detachers) {
      detach();
    }
    this.detachers.length = 0;
    this.listeners.clear();
  }

  // ------------------------------------------------------------- subscriptions

  public subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stable across renders until something changes, as useSyncExternalStore requires. */
  public getSnapshot(): readonly TimelineItem[] {
    return this.store.getNewestFirst();
  }

  public get hasMore(): boolean {
    return !this.reachedStart;
  }

  public get isPaginating(): boolean {
    return this.paginating;
  }

  public get subscriberCount(): number {
    return this.listeners.size;
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  // -------------------------------------------------------------------- rebuild

  private get room(): Room {
    return this.session.getRoom(this.roomId);
  }

  private buildItem(event: MatrixEvent): TimelineItem {
    return buildTimelineItem(event, { room: this.room, ownUserId: this.session.userId });
  }

  private hydrate(): void {
    const events = this.room.getLiveTimeline().getEvents();
    const items = events.filter(isRenderableEvent).map((event) => this.buildItem(event));
    this.store.reset(items);
    this.notify();
  }

  /**
   * Applies an event that annotates another one.
   *
   * Relations do not produce rows of their own: they change the row they point
   * at. Failing to rebuild that target is what leaves a reaction invisible
   * until the screen is reopened.
   *
   * @returns true when the event was a relation and needs no row.
   */
  private applyRelation(event: MatrixEvent): boolean {
    const type = event.getType();

    if (type === EventType.Reaction) {
      const { relatesToEventId } = parseRelation(event.getContent());
      this.rebuild(relatesToEventId);
      return true;
    }

    if (type === EventType.RoomRedaction) {
      const targetId = event.getAssociatedId() ?? null;
      if (targetId && this.store.has(targetId)) {
        // The redaction names its target; the target keeps its position and is
        // rendered as a tombstone.
        this.rebuild(targetId);
        return true;
      }
      // The redaction hit something that has no row of its own — in practice a
      // reaction being removed. A redacted event loses its content, and with it
      // the pointer to the event it annotated, so the affected row cannot be
      // identified from the redaction alone.
      this.rebuildRowsWithReactions();
      return true;
    }

    const { relType, relatesToEventId } = parseRelation(event.getContent());
    if (relType === 'm.replace') {
      this.rebuild(relatesToEventId);
      return true;
    }

    return false;
  }

  private applyEvent(event: MatrixEvent): void {
    if (this.applyRelation(event)) {
      return;
    }

    if (!isRenderableEvent(event)) {
      return;
    }

    // upsert covers both a new row and an update to one already on screen,
    // such as a late decryption replacing an `undecryptable` placeholder, or
    // an edit that arrived after the row was built.
    this.store.upsert(this.buildItem(event));
    this.notify();
  }

  /**
   * Handles a local echo whose ID changed when the homeserver confirmed it.
   *
   * The SDK reuses the same event object and swaps its ID, so the existing row
   * has to be re-keyed. Appending instead would show the message twice.
   */
  private applyLocalEcho(event: MatrixEvent, previousEventId: string | null): void {
    // An outgoing reaction is a relation like any other. Skipping this left
    // the sender's own reaction carrying the provisional event ID, which is
    // the ID needed to remove it again — so a user could not undo a reaction
    // until the room was reopened.
    if (this.applyRelation(event)) {
      return;
    }

    if (!isRenderableEvent(event)) {
      return;
    }

    const item = this.buildItem(event);
    // The provisional ID is not the transaction ID: the SDK keys a pending
    // event as `~<roomId>:<txnId>` and reports the previous value when it
    // swaps in the real one.
    const staleId = previousEventId ?? event.getTxnId();

    if (staleId && staleId !== item.id && this.store.has(staleId)) {
      this.store.replaceId(staleId, item);
    } else {
      this.store.upsert(item);
    }
    this.notify();
  }

  /**
   * Re-aggregates every row that currently shows a reaction.
   *
   * Bounded by what is on screen, and only reached when a relation was
   * redacted, so this is not on the ordinary message path.
   */
  private rebuildRowsWithReactions(): void {
    const ids = this.store
      .getNewestFirst()
      .filter((item) => item.reactions.length > 0)
      .map((item) => item.id);
    for (const id of ids) {
      this.rebuild(id);
    }
  }

  private rebuild(eventId: string | null): void {
    if (!eventId || !this.store.has(eventId)) {
      return;
    }
    const event = this.room.findEventById(eventId);
    if (!event) {
      return;
    }
    this.store.upsert(this.buildItem(event));
    this.notify();
  }

  // ----------------------------------------------------------------- pagination

  /**
   * Loads a page of older messages.
   *
   * Concurrent calls collapse into one request: a fast scroll fires the
   * end-reached callback repeatedly, and 0.0.x issued a request for each.
   *
   * @returns true when more history may remain.
   */
  public async paginateBack(limit = 30): Promise<boolean> {
    if (this.paginating || this.reachedStart) {
      return !this.reachedStart;
    }
    this.paginating = true;
    this.notify();

    try {
      const more = await this.session.paginateBack(this.roomId, limit);
      this.reachedStart = !more;

      const events = this.room.getLiveTimeline().getEvents();
      const older = events
        .filter((event) => isRenderableEvent(event))
        .filter((event) => {
          const id = event.getId();
          return id !== undefined && !this.store.has(id);
        })
        .map((event) => this.buildItem(event));

      if (older.length > 0) {
        this.store.prepend(older);
      }
      return more;
    } finally {
      this.paginating = false;
      this.notify();
    }
  }
}
