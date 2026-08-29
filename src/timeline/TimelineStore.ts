import type { TimelineItem } from '../types/timeline';

/**
 * Ordered collection of timeline rows with incremental updates.
 *
 * 0.0.x rebuilt the entire room model — every event, every content object —
 * on each incoming sync event, for every room in the list. This keeps the
 * rows and mutates only what changed.
 *
 * Internally items are held oldest-first so appending a live message is O(1)
 * and existing indices stay valid. Consumers render newest-first (React
 * Native's inverted FlatList), so the reversed view is cached and rebuilt at
 * most once per change, not once per read.
 *
 * See memory_bank/engineering/architecture.md#timeline-updates.
 */
export class TimelineStore {
  /** Oldest first. */
  private ordered: TimelineItem[] = [];

  private indexById = new Map<string, number>();

  private newestFirstCache: TimelineItem[] | null = null;

  private revision = 0;

  /** Increments whenever the visible content changes. */
  public get version(): number {
    return this.revision;
  }

  public get size(): number {
    return this.ordered.length;
  }

  /** Newest first, ready for an inverted list. The array is not mutated. */
  public getNewestFirst(): readonly TimelineItem[] {
    if (!this.newestFirstCache) {
      this.newestFirstCache = [...this.ordered].reverse();
    }
    return this.newestFirstCache;
  }

  public getById(id: string): TimelineItem | null {
    const index = this.indexById.get(id);
    return index === undefined ? null : (this.ordered[index] ?? null);
  }

  public has(id: string): boolean {
    return this.indexById.has(id);
  }

  /** Replaces the whole contents, e.g. after a timeline reset. */
  public reset(items: TimelineItem[]): void {
    this.ordered = [...items];
    this.reindex();
    this.invalidate();
  }

  /**
   * Inserts or updates one item.
   *
   * A new item newer than everything present is appended, which is the common
   * case for live messages. Anything else is inserted at its timestamp
   * position so late-arriving or back-filled events land correctly.
   */
  public upsert(item: TimelineItem): void {
    const existing = this.indexById.get(item.id);
    if (existing !== undefined) {
      this.ordered[existing] = item;
      this.invalidate();
      return;
    }

    const last = this.ordered[this.ordered.length - 1];
    if (!last || item.ts >= last.ts) {
      this.ordered.push(item);
      this.indexById.set(item.id, this.ordered.length - 1);
      this.invalidate();
      return;
    }

    const position = this.findInsertPosition(item.ts);
    this.ordered.splice(position, 0, item);
    this.reindex();
    this.invalidate();
  }

  /**
   * Swaps a local echo for its confirmed remote event.
   *
   * The SDK reuses one `MatrixEvent` and changes its ID once the homeserver
   * acknowledges the send, so the row must be re-keyed in place rather than
   * appended, otherwise the message appears twice.
   */
  public replaceId(oldId: string, item: TimelineItem): void {
    const index = this.indexById.get(oldId);
    if (index === undefined) {
      this.upsert(item);
      return;
    }
    this.ordered[index] = item;
    this.indexById.delete(oldId);
    this.indexById.set(item.id, index);
    this.invalidate();
  }

  public remove(id: string): void {
    const index = this.indexById.get(id);
    if (index === undefined) {
      return;
    }
    this.ordered.splice(index, 1);
    this.reindex();
    this.invalidate();
  }

  /** Adds a page of older history in front of what is already loaded. */
  public prepend(items: TimelineItem[]): void {
    const fresh = items.filter((item) => !this.indexById.has(item.id));
    if (fresh.length === 0) {
      return;
    }
    this.ordered = [...fresh, ...this.ordered];
    this.reindex();
    this.invalidate();
  }

  /** Applies a transformation to every item, e.g. after a display-name change. */
  public mapItems(transform: (item: TimelineItem) => TimelineItem): void {
    let changed = false;
    this.ordered = this.ordered.map((item) => {
      const next = transform(item);
      if (next !== item) {
        changed = true;
      }
      return next;
    });
    if (changed) {
      this.invalidate();
    }
  }

  private findInsertPosition(ts: number): number {
    // Binary search for the first item newer than `ts`.
    let low = 0;
    let high = this.ordered.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if ((this.ordered[middle] as TimelineItem).ts <= ts) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  private reindex(): void {
    this.indexById.clear();
    for (let index = 0; index < this.ordered.length; index += 1) {
      this.indexById.set((this.ordered[index] as TimelineItem).id, index);
    }
  }

  private invalidate(): void {
    this.newestFirstCache = null;
    this.revision += 1;
  }
}
