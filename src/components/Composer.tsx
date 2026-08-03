import { type ReactElement, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAdapters } from '../react/useAdapters';
import { useTimeline } from '../react/useTimeline';
import { useTyping } from '../react/useTyping';
import type { LocalFile, TimelineItem } from '../types';
import { useMatrixUi } from './MatrixUiProvider';

export interface ComposerProps {
  roomId: string;
  /** Message being replied to. Shown as a cancellable preview. */
  replyTo?: TimelineItem | null;
  onCancelReply?: () => void;
  /** Message being edited. The input is prefilled and Send performs the edit. */
  editing?: TimelineItem | null;
  onCancelEdit?: () => void;
  /** Called after a successful send or edit. */
  onSent?: () => void;
  testID?: string;
}

/**
 * The message input bar.
 *
 * Attachment controls render only for adapters the host actually supplied.
 * That is the whole adapter contract in one place: a button that would throw
 * is not drawn, and nothing pretends to work — see
 * memory_bank/engineering/adapters.md.
 */
export function Composer({
  roomId,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSent,
  testID,
}: ComposerProps): ReactElement {
  const { theme, labels } = useMatrixUi();
  const { sendText, sendFile, editText, error } = useTimeline(roomId);
  const { setTyping } = useTyping(roomId);
  const { has, require: requireAdapter } = useAdapters();

  const [draft, setDraft] = useState(() => editing?.body ?? '');
  const [isBusy, setBusy] = useState(false);

  // Entering edit mode prefills the current text; leaving it clears the box
  // rather than leaving the edited body behind as a draft. This adjusts state
  // during render instead of in an effect: React's documented pattern for
  // state derived from props, and one render pass shorter than the effect it
  // replaces, which is what `react-hooks/set-state-in-effect` asks for.
  const editingKey = editing ? `${editing.id}\u0000${editing.body}` : null;
  const [appliedEditingKey, setAppliedEditingKey] = useState(editingKey);
  if (appliedEditingKey !== editingKey) {
    setAppliedEditingKey(editingKey);
    setDraft(editing?.body ?? '');
  }

  const onChangeText = useCallback(
    (value: string) => {
      setDraft(value);
      setTyping(value.length > 0);
    },
    [setTyping],
  );

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || isBusy) {
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await editText(editing.id, body);
        onCancelEdit?.();
      } else {
        await sendText(body, replyTo ? { replyToEventId: replyTo.id } : undefined);
        onCancelReply?.();
      }
      setDraft('');
      setTyping(false);
      onSent?.();
    } catch {
      // The failure is already surfaced through `error`; keeping the draft in
      // the box is what lets the user try again without retyping it.
    } finally {
      setBusy(false);
    }
  }, [
    draft,
    isBusy,
    editing,
    editText,
    onCancelEdit,
    sendText,
    replyTo,
    onCancelReply,
    setTyping,
    onSent,
  ]);

  const attach = useCallback(
    async (pick: () => Promise<LocalFile | null>) => {
      setBusy(true);
      try {
        const file = await pick();
        if (file) {
          await sendFile(file, replyTo ? { replyToEventId: replyTo.id } : undefined);
          onCancelReply?.();
          onSent?.();
        }
      } catch {
        // Surfaced through `error`; a cancelled picker is not an error at all.
      } finally {
        setBusy(false);
      }
    },
    [sendFile, replyTo, onCancelReply, onSent],
  );

  const canSend = draft.trim().length > 0 && !isBusy;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          padding: theme.spacing.sm,
          gap: theme.spacing.xs,
        },
      ]}
    >
      {editing || replyTo ? (
        <View
          testID={testID ? `${testID}-context` : undefined}
          style={[styles.context, { gap: theme.spacing.sm }]}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: theme.colors.textSecondary, fontSize: theme.fontSize.small }}
          >
            {(editing ?? replyTo)?.body ?? ''}
          </Text>
          <Pressable
            testID={testID ? `${testID}-cancel-context` : undefined}
            accessibilityRole="button"
            accessibilityLabel={labels.cancel}
            onPress={() => (editing ? onCancelEdit?.() : onCancelReply?.())}
          >
            <Text style={{ color: theme.colors.accent, fontSize: theme.fontSize.small }}>
              {labels.cancel}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          style={{ color: theme.colors.danger, fontSize: theme.fontSize.caption }}
        >
          {error.message}
        </Text>
      ) : null}

      <View style={[styles.inputRow, { gap: theme.spacing.sm }]}>
        {has('imagePicker') ? (
          <ComposerAction
            testID={testID ? `${testID}-image` : undefined}
            label={labels.image}
            onPress={() =>
              void attach(() =>
                requireAdapter('imagePicker', 'attach a photo').pickFromLibrary(),
              )
            }
          />
        ) : null}

        {has('documentPicker') ? (
          <ComposerAction
            testID={testID ? `${testID}-file` : undefined}
            label={labels.attach}
            onPress={() => void attach(() => requireAdapter('documentPicker', 'attach a file').pick())}
          />
        ) : null}

        <TextInput
          testID={testID ? `${testID}-input` : undefined}
          accessibilityLabel={labels.composerPlaceholder}
          value={draft}
          onChangeText={onChangeText}
          placeholder={labels.composerPlaceholder}
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          style={[
            styles.input,
            {
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.bubble,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              fontSize: theme.fontSize.body,
            },
          ]}
        />

        <Pressable
          testID={testID ? `${testID}-send` : undefined}
          accessibilityRole="button"
          accessibilityLabel={labels.send}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => void submit()}
        >
          <Text
            style={{
              color: canSend ? theme.colors.accent : theme.colors.textSecondary,
              fontSize: theme.fontSize.body,
              fontWeight: '600',
            }}
          >
            {labels.send}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface ComposerActionProps {
  label: string;
  onPress: () => void;
  testID?: string;
}

function ComposerAction({ label, onPress, testID }: ComposerActionProps): ReactElement {
  const { theme } = useMatrixUi();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
    >
      <Text style={{ color: theme.colors.accent, fontSize: theme.fontSize.body }}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth },
  context: { flexDirection: 'row', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  // A cap rather than a fixed height: the box grows with the draft and then
  // scrolls, instead of pushing the conversation off screen.
  input: { flex: 1, maxHeight: 120 },
});
