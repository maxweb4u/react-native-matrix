import { screen } from '@testing-library/react-native';

import { createFakeSession, fakeEvent } from '../../react/testing/fakeSession';
import { renderWithMatrix } from '../../react/testing/renderWithMatrix';
import { formatDayLabel } from '../../utils/datetime';
import { defaultLabels } from '../labels';
import { MessageList } from '../MessageList';

const ROOM_ID = '!room:localhost';

const MONDAY = Date.UTC(2026, 0, 12, 10, 0, 0);
const MONDAY_LATER = Date.UTC(2026, 0, 12, 23, 30, 0);
const TUESDAY = Date.UTC(2026, 0, 13, 1, 0, 0);

describe('MessageList', () => {
  it('says the conversation is empty rather than rendering a blank screen', async () => {
    await renderWithMatrix(
      createFakeSession({ events: [] }),
      <MessageList testID="list" roomId={ROOM_ID} />,
    );

    expect(screen.getByText(defaultLabels.emptyConversation)).toBeTruthy();
  });

  it('separates messages that fall on different calendar days', async () => {
    const fake = createFakeSession({
      events: [
        fakeEvent({ id: '$1', sender: '@bob:localhost', ts: MONDAY }),
        fakeEvent({ id: '$2', sender: '@bob:localhost', ts: MONDAY_LATER }),
        fakeEvent({ id: '$3', sender: '@bob:localhost', ts: TUESDAY }),
      ],
    });

    await renderWithMatrix(fake, <MessageList testID="list" roomId={ROOM_ID} />);

    // SC-5. Two messages ninety minutes apart across midnight get a separator;
    // two messages thirteen hours apart on the same day do not. 0.0.x compared
    // a fixed millisecond span and got both cases wrong.
    expect(screen.getAllByText(formatDayLabel(TUESDAY, 'en'))).toHaveLength(1);
    expect(screen.getAllByText(formatDayLabel(MONDAY, 'en'))).toHaveLength(1);
  });

  it('shows the sender once per group of consecutive messages', async () => {
    const fake = createFakeSession({
      events: [
        fakeEvent({ id: '$1', sender: '@bob:localhost', ts: MONDAY }),
        fakeEvent({ id: '$2', sender: '@bob:localhost', ts: MONDAY + 60_000 }),
        fakeEvent({ id: '$3', sender: '@carol:localhost', ts: MONDAY + 120_000 }),
      ],
    });

    await renderWithMatrix(fake, <MessageList testID="list" roomId={ROOM_ID} />);

    expect(screen.getByTestId('list-item-$1-sender')).toBeTruthy();
    expect(screen.queryByTestId('list-item-$2-sender')).toBeNull();
    expect(screen.getByTestId('list-item-$3-sender')).toBeTruthy();
  });

  it('renders newest first, as an inverted list requires', async () => {
    const fake = createFakeSession({
      events: [
        fakeEvent({ id: '$old', sender: '@bob:localhost', ts: MONDAY }),
        fakeEvent({ id: '$new', sender: '@bob:localhost', ts: TUESDAY }),
      ],
    });

    await renderWithMatrix(fake, <MessageList testID="list" roomId={ROOM_ID} />);

    const list = screen.getByTestId('list');
    expect(list.props.inverted).toBe(true);
    expect(list.props.data.map((item: { id: string }) => item.id)).toEqual(['$new', '$old']);
  });
});
