import { EventType, type MatrixEvent, RelationType, type Room } from 'matrix-js-sdk';

import type { ReactionSummary } from '../types/content';
import { parseRelation } from './parseContent';

/**
 * Aggregates the reactions attached to one event.
 *
 * 0.0.x tracked a single hard-coded `liked` key, stored the state locally in
 * the component, and offered no way to remove a reaction. This builds the real
 * aggregation the spec describes: any key, grouped with sender lists, and the
 * current user's own reaction event ID so it can be redacted.
 *
 * Redacted reactions are skipped, and a sender is counted once per key even if
 * they somehow sent the same annotation twice.
 *
 * See memory_bank/domain/timeline.md#reactions.
 */
export function aggregateReactions(
  room: Room,
  targetEventId: string,
  ownUserId: string,
): ReactionSummary[] {
  const relations = room
    .getUnfilteredTimelineSet()
    .relations.getChildEventsForEvent(targetEventId, RelationType.Annotation, EventType.Reaction);

  if (!relations) {
    return [];
  }

  return summarizeReactionEvents(relations.getRelations(), ownUserId);
}

/** Pure aggregation over a list of `m.reaction` events. */
function summarizeReactionEvents(
  events: MatrixEvent[],
  ownUserId: string,
): ReactionSummary[] {
  const byKey = new Map<string, { senders: Set<string>; myEventId: string | null }>();

  for (const event of events) {
    if (event.isRedacted()) {
      continue;
    }
    const sender = event.getSender();
    const { key } = parseRelation(event.getContent());
    if (!sender || !key) {
      continue;
    }

    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { senders: new Set<string>(), myEventId: null };
      byKey.set(key, bucket);
    }
    bucket.senders.add(sender);
    if (sender === ownUserId && !bucket.myEventId) {
      bucket.myEventId = event.getId() ?? null;
    }
  }

  const summaries: ReactionSummary[] = [];
  for (const [key, bucket] of byKey) {
    if (bucket.senders.size === 0) {
      continue;
    }
    summaries.push({
      key,
      count: bucket.senders.size,
      senders: [...bucket.senders],
      reactedByMe: bucket.senders.has(ownUserId),
      myReactionEventId: bucket.myEventId,
    });
  }

  // Most-used first, then alphabetically so the order is stable across renders.
  summaries.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return summaries;
}
