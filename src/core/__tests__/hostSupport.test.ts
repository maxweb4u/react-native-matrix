import { HostRequirementError } from '../errors';
import { isHostSupported, missingHostRequirement } from '../hostSupport';

/**
 * Removes `crypto.getRandomValues` for one test, the way Hermes presents.
 *
 * This is the environment-parity hole made visible. `jest.setup.ts` installs
 * Node's webcrypto because the react-native preset does not expose one, so the
 * test environment is strictly more capable than the device the library ships
 * to. Every test below therefore has to take the global away on purpose;
 * without that, no unit test in this repository can fail the way a device does.
 */
function withoutGetRandomValues(body: () => void): void {
  const original = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
  try {
    body();
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
  }
}

describe('missingHostRequirement', () => {
  it('accepts an engine that has crypto.getRandomValues', () => {
    expect(missingHostRequirement()).toBeNull();
    expect(isHostSupported()).toBe(true);
  });

  it('reports the missing global when crypto is absent entirely', () => {
    withoutGetRandomValues(() => {
      expect(missingHostRequirement()?.global).toBe('crypto.getRandomValues');
      expect(isHostSupported()).toBe(false);
    });
  });

  it('reports it when crypto exists but the method does not', () => {
    // Some polyfills install a partial `crypto`. Checking for the object alone
    // would pass here and still fail on the first request.
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
    try {
      expect(missingHostRequirement()?.global).toBe('crypto.getRandomValues');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });

  it('names the package and where the import goes', () => {
    withoutGetRandomValues(() => {
      const requirement = missingHostRequirement();

      // The fix has to be actionable without leaving the error message: the
      // package name alone is not enough, because the import has to be first.
      expect(requirement?.fix).toContain('react-native-get-random-values');
      expect(requirement?.fix).toContain('index.js');
    });
  });
});

describe('HostRequirementError', () => {
  it('carries the missing global and stays instanceof Error', () => {
    withoutGetRandomValues(() => {
      const error = new HostRequirementError(missingHostRequirement()!);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('HostRequirementError');
      expect(error.global).toBe('crypto.getRandomValues');
    });
  });

  it('says what to install and why the session cannot start', () => {
    withoutGetRandomValues(() => {
      const { message } = new HostRequirementError(missingHostRequirement()!);

      expect(message).toContain('crypto.getRandomValues');
      expect(message).toContain('react-native-get-random-values');
      expect(message).toContain('transaction ID');
    });
  });
});
