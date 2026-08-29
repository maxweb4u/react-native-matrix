/**
 * `react-native-matrix/crypto` — the optional encryption entry point.
 *
 * Encryption itself is enabled through `crypto.enabled` on the session
 * options; nothing here has to be imported to send and receive encrypted
 * messages. This module holds what a host needs *around* encryption: checking
 * the environment before offering the feature, turning a room on, and reaching
 * the SDK's crypto API to build verification or key-backup UI, which stay
 * host-owned for 0.1.0.
 *
 * Keeping it behind a separate entry point means an application with no
 * encrypted rooms never pulls it into its bundle.
 *
 * See memory_bank/domain/encryption.md and
 * memory_bank/adr/ADR-003-optional-e2ee-backend.md.
 */

export { assertCryptoSupport, isCryptoSupported } from './assertCryptoSupport';
export { type CryptoApi, getCryptoApi } from './cryptoApi';
export { enableRoomEncryption } from './roomEncryption';
export { useRoomEncryption, type UseRoomEncryptionResult } from './useRoomEncryption';

// Re-exported so a consumer importing only this entry point can still narrow
// the error it catches without a second import from the package root.
export { CryptoUnavailableError } from '../core/errors';
