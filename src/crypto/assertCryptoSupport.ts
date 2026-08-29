import { missingCryptoRequirement } from '../core/cryptoSupport';
import { CryptoUnavailableError } from '../core/errors';
import type { SessionCredentials } from '../types';

/**
 * Checks that encryption can be initialised, before a session is built.
 *
 * `MatrixSession.start()` performs the same check, so calling this is never
 * required. It exists so an application can decide *what to show* — a warning,
 * a downgrade prompt, a disabled toggle — rather than having to catch a
 * failure from `start()` and take it apart.
 *
 * @throws CryptoUnavailableError naming the requirement that is not met.
 */
export function assertCryptoSupport(credentials: Pick<SessionCredentials, 'deviceId'>): void {
  const missing = missingCryptoRequirement(credentials.deviceId);
  if (missing) {
    throw new CryptoUnavailableError(missing);
  }
}

/** The non-throwing form, for gating UI. */
export function isCryptoSupported(credentials: Pick<SessionCredentials, 'deviceId'>): boolean {
  return missingCryptoRequirement(credentials.deviceId) === null;
}
