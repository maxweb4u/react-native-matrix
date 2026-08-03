/**
 * Integration-suite setup.
 *
 * These tests talk to the local Synapse from docker/synapse, so they need real
 * timers and a generous timeout. See memory_bank/ops/synapse.md.
 */

jest.useRealTimers();
jest.setTimeout(60_000);

// matrix-js-sdk logs every request and every sync transition at debug level.
// Jest captures those with a stack trace each, which buries the actual
// assertion failure. Only diagnostics below `warn` are dropped, and only for
// this suite: the `no-console` rule exists to stop the *library* writing to a
// consumer's console, which is the opposite of what happens here.
/* eslint-disable no-console */
console.debug = () => {};
console.info = () => {};
console.log = () => {};
/* eslint-enable no-console */
