import type { MatrixSession } from '../../core/MatrixSession';
import { CryptoUnavailableError } from '../../core/errors';
import { getCryptoApi } from '../cryptoApi';
import { enableRoomEncryption } from '../roomEncryption';

const ROOM_ID = '!room:localhost';

interface FakeParts {
  session: MatrixSession;
  sendStateEvent: jest.Mock;
}

function fakeSession(
  options: { isCryptoEnabled?: boolean; isRoomEncrypted?: boolean; crypto?: object | undefined } = {},
): FakeParts {
  const sendStateEvent = jest.fn(async () => ({ event_id: '$state' }));
  const session = {
    getStatus: () => ({ isCryptoEnabled: options.isCryptoEnabled ?? true }),
    isRoomEncrypted: () => options.isRoomEncrypted ?? false,
    getClient: () => ({
      sendStateEvent,
      getCrypto: () => ('crypto' in options ? options.crypto : {}),
    }),
  } as unknown as MatrixSession;

  return { session, sendStateEvent };
}

describe('enableRoomEncryption', () => {
  it('writes the megolm state event', async () => {
    const { session, sendStateEvent } = fakeSession();

    await enableRoomEncryption(session, ROOM_ID);

    expect(sendStateEvent).toHaveBeenCalledWith(
      ROOM_ID,
      'm.room.encryption',
      { algorithm: 'm.megolm.v1.aes-sha2' },
      '',
    );
  });

  it('does nothing for a room that is already encrypted', async () => {
    const { session, sendStateEvent } = fakeSession({ isRoomEncrypted: true });

    await enableRoomEncryption(session, ROOM_ID);

    // A second state event would rotate the megolm session for no reason.
    expect(sendStateEvent).not.toHaveBeenCalled();
  });

  it('refuses when the session has no crypto backend', async () => {
    const { session, sendStateEvent } = fakeSession({ isCryptoEnabled: false });

    // Encrypting a room this session cannot then read is never what the caller
    // meant, so it fails loudly instead of half-succeeding.
    await expect(enableRoomEncryption(session, ROOM_ID)).rejects.toThrow(CryptoUnavailableError);
    expect(sendStateEvent).not.toHaveBeenCalled();
  });
});

describe('getCryptoApi', () => {
  it('returns the SDK crypto API', () => {
    const { session } = fakeSession();
    expect(getCryptoApi(session)).toEqual({});
  });

  it('throws a named error when the session runs unencrypted', () => {
    const { session } = fakeSession({ crypto: undefined });

    expect(() => getCryptoApi(session)).toThrow(CryptoUnavailableError);
    expect(() => getCryptoApi(session)).toThrow(/crypto\.enabled/);
  });
});
