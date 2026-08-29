/**
 * Builds a {@link TimelineItem} for component tests.
 *
 * Components take view models, not SDK events, so they can be tested without
 * the timeline layer at all. Every field has a neutral default and any of them
 * can be overridden, which keeps a test to the one property it is about.
 *
 * Excluded from the published build by tsconfig.build.json.
 */

import { MessageKind } from '../../types/content';
import type { TimelineItem } from '../../types';

export function fakeTimelineItem(overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: '$item',
    txnId: null,
    roomId: '!room:localhost',
    sender: '@bob:localhost',
    senderDisplayName: 'Bob',
    senderAvatarMxcUri: null,
    isOwn: false,
    ts: Date.UTC(2026, 0, 15, 12, 0, 0),
    kind: MessageKind.Text,
    body: 'hello',
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
  };
}
