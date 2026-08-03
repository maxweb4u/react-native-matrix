import { fireEvent, screen } from '@testing-library/react-native';

import { createFakeSession } from '../../react/testing/fakeSession';
import { fakeTimelineItem } from '../../react/testing/fakeTimelineItem';
import { renderWithMatrix } from '../../react/testing/renderWithMatrix';
import { MessageKind } from '../../types/content';
import { defaultLabels } from '../labels';
import { MessageRow } from '../MessageRow';

const fake = () => createFakeSession();

describe('MessageRow', () => {
  it('renders the body and the sender of an incoming message', async () => {
    await renderWithMatrix(
      fake(),
      <MessageRow testID="row" item={fakeTimelineItem({ body: 'hello there' })} />,
    );

    expect(screen.getByText('hello there')).toBeTruthy();
    expect(screen.getByTestId('row-sender')).toBeTruthy();
  });

  it('hides the sender for a message grouped under the previous one', async () => {
    await renderWithMatrix(fake(), <MessageRow testID="row" item={fakeTimelineItem()} showSender={false} />);

    expect(screen.queryByTestId('row-sender')).toBeNull();
  });

  it('never renders an own message with a sender line', async () => {
    await renderWithMatrix(fake(), <MessageRow testID="row" item={fakeTimelineItem({ isOwn: true })} />);

    expect(screen.queryByTestId('row-sender')).toBeNull();
  });

  describe('states that would otherwise be an empty bubble', () => {
    it('names a deleted message', async () => {
      await renderWithMatrix(
        fake(),
        <MessageRow
          item={fakeTimelineItem({ isRedacted: true, kind: MessageKind.Redacted, body: '' })}
        />,
      );

      expect(screen.getByText(defaultLabels.deletedMessage)).toBeTruthy();
    });

    it('names a message it could not decrypt', async () => {
      await renderWithMatrix(
        fake(),
        <MessageRow
          item={fakeTimelineItem({ kind: MessageKind.UndecryptableEncrypted, body: '' })}
        />,
      );

      expect(screen.getByText(defaultLabels.undecryptableMessage)).toBeTruthy();
    });

    it('names a msgtype it does not render', async () => {
      await renderWithMatrix(
        fake(),
        <MessageRow item={fakeTimelineItem({ kind: MessageKind.Unsupported, body: '' })} />,
      );

      expect(screen.getByText(defaultLabels.unsupportedMessage)).toBeTruthy();
    });
  });

  it('marks an edited message', async () => {
    await renderWithMatrix(
      fake(),
      <MessageRow testID="row" item={fakeTimelineItem({ isEdited: true, editedTs: 1 })} />,
    );

    expect(screen.getByTestId('row-edited')).toBeTruthy();
  });

  it('renders the quoted message of a reply', async () => {
    await renderWithMatrix(
      fake(),
      <MessageRow
        testID="row"
        item={fakeTimelineItem({
          body: 'the answer',
          replyTo: {
            eventId: '$quoted',
            sender: '@alice:localhost',
            senderDisplayName: 'Alice',
            body: 'the question',
          },
        })}
      />,
    );

    expect(screen.getByTestId('row-reply')).toBeTruthy();
    expect(screen.getByText('the question')).toBeTruthy();
    // The fallback quote is stripped upstream, so the body is the reply alone.
    expect(screen.getByText('the answer')).toBeTruthy();
  });

  it('reports the reaction key that was pressed', async () => {
    const onPressReaction = jest.fn();
    await renderWithMatrix(
      fake(),
      <MessageRow
        testID="row"
        item={fakeTimelineItem({
          reactions: [
            { key: '👍', count: 2, senders: ['@a:l', '@b:l'], reactedByMe: true, myReactionEventId: '$r' },
          ],
        })}
        onPressReaction={onPressReaction}
      />,
    );

    await fireEvent.press(screen.getByTestId('row-reactions-👍'));

    expect(onPressReaction).toHaveBeenCalledWith(expect.objectContaining({ id: '$item' }), '👍');
  });

  it('offers no retry for a message that was sent', async () => {
    await renderWithMatrix(
      fake(),
      <MessageRow testID="row" item={fakeTimelineItem({ isOwn: true, sendState: 'sent' })} />,
    );

    expect(screen.queryByTestId('row-retry')).toBeNull();
  });

  it('offers a retry for a message that failed to send', async () => {
    const onRetry = jest.fn();
    await renderWithMatrix(
      fake(),
      <MessageRow
        testID="row"
        item={fakeTimelineItem({
          isOwn: true,
          sendState: 'failed',
          sendError: 'Message could not be sent',
        })}
        onRetry={onRetry}
      />,
    );

    // A failed attachment must stay on screen with a way back, not disappear
    // (FM-5 in the feature's failure modes).
    expect(screen.getByText('Message could not be sent')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('row-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('describes an attachment instead of leaving the bubble blank', async () => {
    await renderWithMatrix(
      fake(),
      <MessageRow
        item={fakeTimelineItem({
          kind: MessageKind.File,
          body: 'quarterly-report.pdf',
          media: {
            mxcUri: 'mxc://homeserver.test/abc',
            localUri: null,
            mimeType: 'application/pdf',
            size: 2048,
            width: null,
            height: null,
            durationMs: null,
            thumbnailMxcUri: null,
            blurhash: null,
          },
        })}
      />,
    );

    expect(screen.getByText('quarterly-report.pdf')).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
  });
});
