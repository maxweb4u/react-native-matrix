import { EventType } from 'matrix-js-sdk';

import { CryptoUnavailableError } from '../core/errors';
import type { MatrixSession } from '../core/MatrixSession';

/** The only algorithm the spec defines for room messages. */
const MEGOLM = 'm.megolm.v1.aes-sha2';

/**
 * Turns on encryption for an existing room.
 *
 * **This cannot be undone.** The Matrix specification has no way to disable
 * encryption once a room is encrypted; a client that appears to offer one is
 * lying. Callers should confirm with the user first.
 *
 * Idempotent: a room that is already encrypted is left alone rather than
 * having a second state event written, which would rotate the megolm session
 * for no reason.
 *
 * @throws CryptoUnavailableError when the session runs without a crypto
 * backend — encrypting a room the local session cannot read is never useful.
 */
export async function enableRoomEncryption(
  session: MatrixSession,
  roomId: string,
): Promise<void> {
  if (!session.getStatus().isCryptoEnabled) {
    throw new CryptoUnavailableError(
      'this session was started without crypto.enabled, so it could not read ' +
        'the room it just encrypted',
    );
  }

  if (session.isRoomEncrypted(roomId)) {
    return;
  }

  await session
    .getClient()
    .sendStateEvent(roomId, EventType.RoomEncryption, { algorithm: MEGOLM }, '');
}
