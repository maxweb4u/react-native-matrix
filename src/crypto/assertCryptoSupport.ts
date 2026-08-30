import { missingCryptoRequirement, missingEngineRequirement } from '../core/cryptoSupport';
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

/**
 * The unmet requirement, or null when encryption can start.
 *
 * `isCryptoSupported` answers whether; this answers why, so an application can
 * put the reason on screen instead of leaving a control that does nothing.
 */
export function cryptoUnavailableReason(
  credentials: Pick<SessionCredentials, 'deviceId'>,
): string | null {
  return missingCryptoRequirement(credentials.deviceId);
}

/**
 * Whether the engine can run encryption at all, independent of credentials.
 *
 * For UI shown before sign-in, where no device ID exists yet and the engine is
 * the only thing that can be checked. Returns the reason, or null when the
 * engine is capable.
 */
export function engineCryptoLimitation(): string | null {
  return missingEngineRequirement();
}
