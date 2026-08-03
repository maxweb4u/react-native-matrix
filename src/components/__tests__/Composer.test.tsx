import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createFakeSession, type FakeSession } from '../../react/testing/fakeSession';
import { fakeTimelineItem } from '../../react/testing/fakeTimelineItem';
import { renderWithMatrix } from '../../react/testing/renderWithMatrix';
import type { LocalFile } from '../../types';
import { Composer } from '../Composer';
import { defaultLabels } from '../labels';

const ROOM_ID = '!room:localhost';

const pickedImage: LocalFile = {
  uri: 'file:///tmp/photo.jpg',
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
};

describe('Composer', () => {
  it('sends the trimmed draft and clears the box', async () => {
    const fake = createFakeSession();
    await renderWithMatrix(fake, <Composer testID="composer" roomId={ROOM_ID} />);

    await fireEvent.changeText(screen.getByTestId('composer-input'), '  hello  ');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('composer-send'));
    });

    expect(fake.sent).toEqual(['hello']);
    expect(screen.getByTestId('composer-input').props.value).toBe('');
  });

  it('refuses to send whitespace', async () => {
    const fake = createFakeSession();
    await renderWithMatrix(fake, <Composer testID="composer" roomId={ROOM_ID} />);

    await fireEvent.changeText(screen.getByTestId('composer-input'), '   ');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('composer-send'));
    });

    expect(fake.sent).toEqual([]);
    expect(screen.getByTestId('composer-send').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('reports typing while the draft is non-empty and stops when it is cleared', async () => {
    const fake = createFakeSession();
    await renderWithMatrix(fake, <Composer testID="composer" roomId={ROOM_ID} />);

    await fireEvent.changeText(screen.getByTestId('composer-input'), 'h');
    expect(fake.typing).toEqual([true]);

    // Throttled: a second keystroke inside the window sends nothing more.
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'he');
    expect(fake.typing).toEqual([true]);

    await fireEvent.changeText(screen.getByTestId('composer-input'), '');
    expect(fake.typing).toEqual([true, false]);
  });

  describe('adapter-gated attachments', () => {
    it('offers no attachment controls when the host wired no adapters', async () => {
      await renderWithMatrix(createFakeSession(), <Composer testID="composer" roomId={ROOM_ID} />);

      // SC-11: a control that would throw is not drawn at all.
      expect(screen.queryByTestId('composer-image')).toBeNull();
      expect(screen.queryByTestId('composer-file')).toBeNull();
    });

    it('offers the photo control and uploads the picked file', async () => {
      const pickFromLibrary = jest.fn(async () => pickedImage);
      const fake: FakeSession = createFakeSession({
        adapters: { imagePicker: { pickFromLibrary } },
      });
      await renderWithMatrix(fake, <Composer testID="composer" roomId={ROOM_ID} />);

      await act(async () => {
        await fireEvent.press(screen.getByTestId('composer-image'));
      });

      expect(pickFromLibrary).toHaveBeenCalledTimes(1);
      expect(fake.files).toEqual([pickedImage]);
    });

    it('sends nothing when the picker is cancelled', async () => {
      const fake = createFakeSession({
        adapters: { imagePicker: { pickFromLibrary: async () => null } },
      });
      await renderWithMatrix(fake, <Composer testID="composer" roomId={ROOM_ID} />);

      await act(async () => {
        await fireEvent.press(screen.getByTestId('composer-image'));
      });

      expect(fake.files).toEqual([]);
    });
  });

  describe('replying and editing', () => {
    it('sends a reply against the quoted event and clears the context', async () => {
      const fake = createFakeSession();
      const onCancelReply = jest.fn();
      await renderWithMatrix(
        fake,
        <Composer
          testID="composer"
          roomId={ROOM_ID}
          replyTo={fakeTimelineItem({ id: '$quoted', body: 'the question' })}
          onCancelReply={onCancelReply}
        />,
      );

      expect(screen.getByTestId('composer-context')).toBeTruthy();

      await fireEvent.changeText(screen.getByTestId('composer-input'), 'the answer');
      await act(async () => {
        await fireEvent.press(screen.getByTestId('composer-send'));
      });

      expect(fake.sent).toEqual(['the answer']);
      expect(onCancelReply).toHaveBeenCalled();
    });

    it('prefills the draft when editing and sends an edit rather than a message', async () => {
      const fake = createFakeSession();
      const onCancelEdit = jest.fn();
      await renderWithMatrix(
        fake,
        <Composer
          testID="composer"
          roomId={ROOM_ID}
          editing={fakeTimelineItem({ id: '$original', body: 'typo hre', isOwn: true })}
          onCancelEdit={onCancelEdit}
        />,
      );

      expect(screen.getByTestId('composer-input').props.value).toBe('typo hre');

      await fireEvent.changeText(screen.getByTestId('composer-input'), 'typo here');
      await act(async () => {
        await fireEvent.press(screen.getByTestId('composer-send'));
      });

      expect(fake.edits).toEqual([{ eventId: '$original', body: 'typo here' }]);
      expect(fake.sent).toEqual([]);
      expect(onCancelEdit).toHaveBeenCalled();
    });

    it('cancels the reply context without sending', async () => {
      const onCancelReply = jest.fn();
      await renderWithMatrix(
        createFakeSession(),
        <Composer
          testID="composer"
          roomId={ROOM_ID}
          replyTo={fakeTimelineItem({ id: '$quoted' })}
          onCancelReply={onCancelReply}
        />,
      );

      await fireEvent.press(screen.getByTestId('composer-cancel-context'));
      expect(onCancelReply).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the draft and shows the reason when sending fails', async () => {
    const fake = createFakeSession();
    (fake.session as unknown as { sendText: () => Promise<string> }).sendText = () => {
      throw new Error('Homeserver unreachable');
    };
    await renderWithMatrix(fake, <Composer testID="composer" roomId={ROOM_ID} />);

    await fireEvent.changeText(screen.getByTestId('composer-input'), 'keep me');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('composer-send'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('composer-error')).toBeTruthy();
    });
    // Retyping a lost draft is the worst possible response to a failed send.
    expect(screen.getByTestId('composer-input').props.value).toBe('keep me');
    expect(screen.getByText('Homeserver unreachable')).toBeTruthy();
  });

  it('labels the placeholder from the label set', async () => {
    await renderWithMatrix(createFakeSession(), <Composer testID="composer" roomId={ROOM_ID} />);

    expect(screen.getByTestId('composer-input').props.placeholder).toBe(
      defaultLabels.composerPlaceholder,
    );
  });
});
