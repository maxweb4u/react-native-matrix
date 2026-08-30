/**
 * Per-room notification settings, expressed the way a user thinks about them.
 *
 * The protocol has no "notification level". It has push rules of five kinds
 * evaluated in a fixed order, and the settings a chat application actually
 * offers are emergent combinations of them. This module owns that mapping in
 * one place so no consumer has to learn the ordering.
 *
 * See memory_bank/domain/push.md.
 */

import {
  ConditionKind,
  type IPushRule,
  type IPushRules,
  type MatrixClient,
  PushRuleActionName,
  PushRuleKind,
} from 'matrix-js-sdk';

import { NotificationLevel } from '../types/push';

const GLOBAL = 'global';

/**
 * True when a rule's actions mean "do not notify".
 *
 * Both spellings are live: `dont_notify` is the historical action and an
 * empty array is what the specification moved to. Reading only one of them
 * misreports rooms muted by another client.
 */
export function isSuppressing(actions: readonly unknown[] | undefined): boolean {
  if (!actions) {
    return false;
  }
  return actions.length === 0 || actions.includes(PushRuleActionName.DontNotify);
}

/** True when this rule targets exactly this room. */
function targetsRoom(rule: IPushRule, roomId: string): boolean {
  if (rule.rule_id === roomId) {
    return true;
  }
  return (rule.conditions ?? []).some(
    (condition) =>
      condition.kind === ConditionKind.EventMatch &&
      condition.key === 'room_id' &&
      condition.pattern === roomId,
  );
}

function findRule(
  rules: IPushRules | null | undefined,
  kind: PushRuleKind,
  roomId: string,
): IPushRule | null {
  const set = rules?.global?.[kind] as IPushRule[] | undefined;
  return set?.find((rule) => rule.enabled !== false && targetsRoom(rule, roomId)) ?? null;
}

/**
 * Reads what a room currently notifies for.
 *
 * An `override` rule outranks the mention rules, so it silences everything; a
 * `room` rule sits below them, so mentions still get through. That ordering is
 * the entire difference between the two quiet levels, and it is why the SDK's
 * own `setRoomMutePushRule` — which writes a `room` rule — does not mute.
 */
export function readNotificationLevel(
  rules: IPushRules | null | undefined,
  roomId: string,
): NotificationLevel {
  const override = findRule(rules, PushRuleKind.Override, roomId);
  if (override && isSuppressing(override.actions)) {
    return NotificationLevel.Mute;
  }
  const room = findRule(rules, PushRuleKind.RoomSpecific, roomId);
  if (room && isSuppressing(room.actions)) {
    return NotificationLevel.Mentions;
  }
  return NotificationLevel.All;
}

async function deleteIfPresent(
  client: MatrixClient,
  rules: IPushRules | null | undefined,
  kind: PushRuleKind,
  roomId: string,
): Promise<void> {
  const rule = findRule(rules, kind, roomId);
  if (rule) {
    await client.deletePushRule(GLOBAL, kind, rule.rule_id);
  }
}

/**
 * Writes the rules for a level, removing whatever the previous level left.
 *
 * Always clears both kinds first. Adding a rule on top of an existing one of
 * the other kind leaves a room that reads as muted but still notifies, or the
 * reverse — and the leftover is invisible in any UI that only renders the
 * current level.
 */
export async function applyNotificationLevel(
  client: MatrixClient,
  roomId: string,
  level: NotificationLevel,
): Promise<void> {
  const rules = await client.getPushRules();
  await deleteIfPresent(client, rules, PushRuleKind.Override, roomId);
  await deleteIfPresent(client, rules, PushRuleKind.RoomSpecific, roomId);

  if (level === NotificationLevel.Mute) {
    await client.addPushRule(GLOBAL, PushRuleKind.Override, roomId, {
      actions: [PushRuleActionName.DontNotify],
      conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
    });
    return;
  }
  if (level === NotificationLevel.Mentions) {
    await client.addPushRule(GLOBAL, PushRuleKind.RoomSpecific, roomId, {
      actions: [PushRuleActionName.DontNotify],
    });
  }
  // NotificationLevel.All is the absence of a rule, so the deletions above are
  // the whole operation.
}
