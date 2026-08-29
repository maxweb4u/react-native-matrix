/**
 * Two projects share one transform pipeline:
 *   unit        — fast, no network, mocked matrix-js-sdk where needed
 *   integration — runs against the local Synapse from docker/synapse
 *
 * See memory_bank/engineering/testing-policy.md
 */
const shared = {
  // React Native 0.87 no longer ships the preset inside the `react-native`
  // package; it is the standalone `@react-native/jest-preset`.
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // matrix-js-sdk resolves to its TypeScript sources and pulls in ESM-only
  // packages, which have to be transformed too. The list tracks the SDK's own
  // dependencies: 42 dropped uuid, jwt-decode and oidc-client-ts, and moved to
  // p-retry 8, which is ESM and brings is-network-error with it. bs58 and its
  // base-x are ESM as well and are reached through the SDK's key encoding.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|matrix-js-sdk|@matrix-org|p-retry|is-network-error|bs58|base-x)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.ts',
        '<rootDir>/src/**/__tests__/**/*.test.tsx',
      ],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/integration/**/*.test.ts'],
      moduleNameMapper: {
        // The crypto backend ships four builds behind export conditions. Jest
        // resolves the browser ESM one, whose `import()` of the .wasm file
        // cannot run inside Jest's CommonJS VM. `node.cjs` is the same module
        // loading the binary with `fs`, which is what a Node test run needs.
        // React Native picks its own build through Metro and is unaffected.
        '^@matrix-org/matrix-sdk-crypto-wasm$':
          '<rootDir>/node_modules/@matrix-org/matrix-sdk-crypto-wasm/node.cjs',
      },
      // Real network round-trips against Synapse; the default 5s is not enough.
      // integration/setup.ts raises the timeout and restores real timers.
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/integration/setup.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/testing/**',
    '!src/**/index.ts',
  ],
  // A floor, not a target: scenario coverage is what the testing policy asks
  // for. This exists so the number cannot quietly fall, which it did while
  // modules were added faster than tests. Set just under the measured value
  // so ordinary work does not trip it; raise it when a run clears the next
  // step. `core` sits low on purpose — MatrixSession is covered by the
  // integration suite, which does not report here.
  // See memory_bank/engineering/testing-policy.md#required-coverage.
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 63,
      functions: 67,
      lines: 69,
    },
  },
};
