/**
 * Preconditions for end-to-end encryption, and how a failure is described.
 *
 * These live in `core` because the session runs the same checks before it
 * starts. `react-native-matrix/crypto` re-exports the public assertion so a
 * host can run them before it even builds a session.
 *
 * See memory_bank/domain/encryption.md#requirements.
 */

/**
 * The first unmet requirement, or null when encryption can be initialised.
 *
 * The order matters: the engine check comes first because a missing
 * `deviceId` is fixable by the caller, while a missing WebAssembly engine is
 * not, and reporting the fixable one first would send a developer down the
 * wrong path.
 */
/**
 * Reads an optional global without assuming a `lib` that declares it.
 *
 * `globalThis.WebAssembly` only typechecks when the consumer's `tsconfig`
 * includes the DOM or ES2020 libs. Consumers configure their own compiler, so
 * the library must not depend on theirs.
 */
function globalExists(name: string): boolean {
  return (globalThis as Record<string, unknown>)[name] !== undefined;
}

export function missingCryptoRequirement(deviceId: string | undefined): string | null {
  if (!globalExists('WebAssembly')) {
    return (
      'this JavaScript engine has no WebAssembly support. ' +
      'Stock React Native does not provide it: measured undefined on 0.87 with ' +
      'Hermes enabled. A WebAssembly-capable engine or polyfill is required'
    );
  }
  if (!deviceId) {
    return (
      'no deviceId was supplied. Encryption keys belong to a device, so the ' +
      'session needs the device ID issued at login'
    );
  }
  return null;
}

/** True when the engine has an IndexedDB the crypto store can persist to. */
export function hasIndexedDB(): boolean {
  return globalExists('indexedDB');
}

/**
 * Turns a backend initialisation failure into a reason that names the piece
 * that failed, rather than a bare stack trace from inside the SDK.
 */
export function describeCryptoFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/cannot find module|failed to resolve|module_not_found/i.test(message)) {
    return '@matrix-org/matrix-sdk-crypto-wasm could not be loaded';
  }
  if (/webassembly|wasm/i.test(message)) {
    return 'the WebAssembly crypto backend could not be instantiated';
  }
  return `the crypto backend failed to initialise (${message})`;
}
