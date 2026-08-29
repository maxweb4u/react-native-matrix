import { act, screen } from '@testing-library/react-native';

import { createFakeSession, type FakeSession } from '../../react/testing/fakeSession';
import { renderWithMatrix } from '../../react/testing/renderWithMatrix';
import { MatrixUiProvider } from '../MatrixUiProvider';
import { TypingIndicator } from '../TypingIndicator';

const ROOM_ID = '!room:localhost';

const withMembers = (): FakeSession =>
  createFakeSession({
    members: [
      { userId: '@alice:localhost', displayName: 'Alice' },
      { userId: '@bob:localhost', displayName: 'Bob' },
      { userId: '@carol:localhost', displayName: 'Carol' },
    ],
  });

describe('TypingIndicator', () => {
  it('renders nothing when nobody is typing', async () => {
    // Not an empty reserved row: the conversation would shift by a line every
    // few seconds if this returned one.
    await renderWithMatrix(withMembers(), <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    expect(screen.queryByTestId('typing')).toBeNull();
  });

  it('names one person', async () => {
    const fake = withMembers();
    await renderWithMatrix(fake, <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    await act(async () => {
      fake.emitTyping(['@alice:localhost']);
    });

    expect(screen.getByTestId('typing').props.children).toBe('Alice is typing…');
  });

  it('names two people', async () => {
    const fake = withMembers();
    await renderWithMatrix(fake, <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    await act(async () => {
      fake.emitTyping(['@alice:localhost', '@bob:localhost']);
    });

    expect(screen.getByTestId('typing').props.children).toBe('Alice and Bob are typing…');
  });

  it('counts three or more rather than listing them', async () => {
    const fake = withMembers();
    await renderWithMatrix(fake, <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    await act(async () => {
      fake.emitTyping(['@alice:localhost', '@bob:localhost', '@carol:localhost']);
    });

    expect(screen.getByTestId('typing').props.children).toBe('3 people are typing…');
  });

  it('falls back to the user ID for someone the room does not know', async () => {
    // A member can type before their membership event has synced.
    const fake = withMembers();
    await renderWithMatrix(fake, <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    await act(async () => {
      fake.emitTyping(['@dave:localhost']);
    });

    expect(screen.getByTestId('typing').props.children).toBe('@dave:localhost is typing…');
  });

  it('disappears again when everyone stops', async () => {
    const fake = withMembers();
    await renderWithMatrix(fake, <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    await act(async () => {
      fake.emitTyping(['@alice:localhost']);
    });
    expect(screen.getByTestId('typing')).toBeTruthy();

    await act(async () => {
      fake.emitTyping([]);
    });
    expect(screen.queryByTestId('typing')).toBeNull();
  });

  it('ignores typing in another room', async () => {
    const fake = createFakeSession({
      members: [{ userId: '@alice:localhost', displayName: 'Alice' }],
      rooms: [{ roomId: '!other:localhost' }],
    });
    await renderWithMatrix(fake, <TypingIndicator testID="typing" roomId={ROOM_ID} />);

    await act(async () => {
      fake.emitTyping(['@alice:localhost'], '!other:localhost');
    });

    expect(screen.queryByTestId('typing')).toBeNull();
  });

  it('takes every phrasing from the provider, including the plural forms', async () => {
    // All three are functions on the public labels object, so a translation
    // controls word order and pluralisation rather than receiving a template.
    const fake = withMembers();
    await renderWithMatrix(
      fake,
      <MatrixUiProvider
        labels={{
          typingOne: (name) => `${name} schreibt…`,
          typingMany: (count) => `${count} Personen schreiben…`,
        }}
      >
        <TypingIndicator testID="typing" roomId={ROOM_ID} />
      </MatrixUiProvider>,
    );

    await act(async () => {
      fake.emitTyping(['@alice:localhost']);
    });
    expect(screen.getByTestId('typing').props.children).toBe('Alice schreibt…');

    await act(async () => {
      fake.emitTyping(['@alice:localhost', '@bob:localhost', '@carol:localhost']);
    });
    expect(screen.getByTestId('typing').props.children).toBe('3 Personen schreiben…');
  });
});
