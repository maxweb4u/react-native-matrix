/**
 * Global test setup. Deliberately minimal: the library has no runtime
 * dependencies, so there is little to polyfill beyond what the react-native
 * preset already provides.
 */

// matrix-js-sdk touches `global.crypto.getRandomValues` in a few code paths.
// Node 20 provides webcrypto, but the react-native jest environment does not
// expose it on the global object.
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

afterEach(() => {
  jest.clearAllMocks();
});
