import type { MatrixClient } from 'matrix-js-sdk';

import { CryptoUnavailableError } from '../core/errors';
import type { MatrixSession } from '../core/MatrixSession';

/**
 * The SDK's crypto surface.
 *
 * Derived from the client rather than imported from a deep path inside
 * `matrix-js-sdk`, which is not part of that package's public entry point and
 * has moved between majors.
 */
export type CryptoApi = NonNullable<ReturnType<MatrixClient['getCrypto']>>;

/**
 * The crypto API of a session that was started with `crypto.enabled`.
 *
 * Device verification, cross-signing, and key backup are deliberately not
 * wrapped: their UI is host-owned for 1.0.0, and a thin wrapper over a large,
 * fast-moving API would age worse than the API itself. This is the seam that
 * lets a host build them.
 *
 * @throws CryptoUnavailableError when the session runs without encryption.
 */
export function getCryptoApi(session: MatrixSession): CryptoApi {
  const api = session.getClient().getCrypto();
  if (!api) {
    throw new CryptoUnavailableError(
      'this session was started without crypto.enabled, so it has no crypto backend',
    );
  }
  return api;
}
