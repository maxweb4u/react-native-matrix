import { fireEvent, screen } from '@testing-library/react-native';

import { createFakeSession } from '../../react/testing/fakeSession';
import { renderWithMatrix } from '../../react/testing/renderWithMatrix';
import { MessageKind } from '../../types/content';
import type { RoomSummary } from '../../types';
import { defaultLabels } from '../labels';
import { RoomListItem } from '../RoomListItem';

function summary(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: '!room:localhost',
    name: 'Project',
    avatarMxcUri: null,
    isDirect: false,
    directUserId: null,
    membership: 'join',
    isEncrypted: false,
    unreadCount: 0,
    highlightCount: 0,
    lastActivityTs: Date.UTC(2026, 0, 15, 9, 0, 0),
    lastMessage: {
      eventId: '$1',
      sender: '@bob:localhost',
      senderDisplayName: 'Bob',
      body: 'see you then',
      kind: MessageKind.Text,
      ts: Date.UTC(2026, 0, 15, 9, 0, 0),
      isOwn: false,
    },
    memberCount: 2,
    ...overrides,
  };
}

describe('RoomListItem', () => {
  it('previews the last message', async () => {
    await renderWithMatrix(createFakeSession(), <RoomListItem testID="row" room={summary()} />);

    expect(screen.getByTestId('row-preview').props.children).toBe('see you then');
  });

  it('marks the preview when the last message is the user’s own', async () => {
    await renderWithMatrix(
      createFakeSession(),
      <RoomListItem
        testID="row"
        room={summary({
          lastMessage: { ...summary().lastMessage!, isOwn: true },
        })}
      />,
    );

    expect(screen.getByTestId('row-preview').props.children).toBe('You: see you then');
  });

  it('names an attachment rather than previewing an empty body', async () => {
    await renderWithMatrix(
      createFakeSession(),
      <RoomListItem
        testID="row"
        room={summary({
          lastMessage: { ...summary().lastMessage!, kind: MessageKind.Image, body: 'IMG_0001.jpg' },
        })}
      />,
    );

    expect(screen.getByTestId('row-preview').props.children).toBe(defaultLabels.image);
  });

  it('says so when there is nothing to preview', async () => {
    await renderWithMatrix(
      createFakeSession(),
      <RoomListItem testID="row" room={summary({ lastMessage: null })} />,
    );

    expect(screen.getByTestId('row-preview').props.children).toBe(defaultLabels.noMessagesYet);
  });

  it('shows an unread badge only when there is something unread', async () => {
    const { unmount } = await renderWithMatrix(
      createFakeSession(),
      <RoomListItem testID="row" room={summary({ unreadCount: 0 })} />,
    );
    expect(screen.queryByTestId('row-unread')).toBeNull();
    await unmount();

    await renderWithMatrix(
      createFakeSession(),
      <RoomListItem testID="row" room={summary({ unreadCount: 3 })} />,
    );
    expect(screen.getByTestId('row-unread')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('offers accept and decline for a pending invite', async () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    await renderWithMatrix(
      createFakeSession(),
      <RoomListItem
        testID="row"
        room={summary({ membership: 'invite', lastMessage: null })}
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    expect(screen.getByTestId('row-preview').props.children).toBe(defaultLabels.invitation);

    await fireEvent.press(screen.getByTestId('row-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('row-decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('offers no invite actions for a joined room', async () => {
    await renderWithMatrix(
      createFakeSession(),
      <RoomListItem testID="row" room={summary()} onAccept={jest.fn()} onDecline={jest.fn()} />,
    );

    expect(screen.queryByTestId('row-accept')).toBeNull();
  });
});
