/**
 * Preconditions the host environment must satisfy before any session runs.
 *
 * These are distinct from the crypto preconditions in `cryptoSupport.ts`: those
 * gate an optional feature, these gate the library working at all. Both exist
 * for the same reason — Hermes is missing globals that every test environment
 * has, so the failure is invisible to `npm run verify` and only appears on a
 * device.
 *
 * See memory_bank/engineering/gotchas.md#react-native.
 */

/** A global the library needs, and what a host does about it. */
export interface HostRequirement {
  /** The global as a developer would search for it, e.g. `crypto.getRandomValues`. */
  global: string;
  /** Why the library cannot proceed without it. */
  reason: string;
  /** The concrete fix, naming the package and where the import goes. */
  fix: string;
}

/**
 * Reads a nested global without assuming a `lib` that declares it.
 *
 * Consumers configure their own compiler, so the library must not depend on
 * whether their `tsconfig` includes the DOM lib.
 */
function globalMember(namespace: string, member: string): unknown {
  const holder = (globalThis as Record<string, unknown>)[namespace];
  if (holder === undefined || holder === null) {
    return undefined;
  }
  return (holder as Record<string, unknown>)[member];
}

/**
 * The first unmet host requirement, or null when the environment is usable.
 *
 * Exported so a host can check before building a session — the same shape as
 * `isCryptoSupported` for the optional crypto backend.
 */
export function missingHostRequirement(): HostRequirement | null {
  if (typeof globalMember('crypto', 'getRandomValues') !== 'function') {
    return {
      global: 'crypto.getRandomValues',
      reason:
        'matrix-js-sdk generates the transaction ID of every request with it, ' +
        'so the session fails on its first request rather than at startup',
      fix:
        'npm install react-native-get-random-values, then import it as the ' +
        "very first line of index.js: import 'react-native-get-random-values';",
    };
  }
  return null;
}

/** True when the environment satisfies every host requirement. */
export function isHostSupported(): boolean {
  return missingHostRequirement() === null;
}
