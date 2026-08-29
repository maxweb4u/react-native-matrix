/**
 * Connection details and login for the local Synapse.
 *
 * The server lifecycle and the account list are owned by
 * memory_bank/ops/synapse.md; this module only consumes them.
 */

import type { SessionCredentials } from '../../src/types';

/** Overridable so the suite can be pointed at a disposable CI homeserver. */
export const HOMESERVER_URL = process.env.MATRIX_HOMESERVER_URL ?? 'http://localhost:8008';

export interface TestAccount {
  readonly localpart: string;
  readonly password: string;
  readonly userId: string;
}

export const ALICE: TestAccount = {
  localpart: 'alice',
  password: 'alice-password',
  userId: '@alice:localhost',
};

export const BOB: TestAccount = {
  localpart: 'bob',
  password: 'bob-password',
  userId: '@bob:localhost',
};

/** Every login here creates a device, so the ID is always present. */
export type TestCredentials = SessionCredentials & { deviceId: string };

/**
 * Fails with an actionable message rather than a bare socket error.
 *
 * Every suite calls this first: a stopped homeserver otherwise surfaces as a
 * dozen unrelated timeouts with nothing naming the actual cause.
 */
export async function requireHomeserver(): Promise<void> {
  let reachable: boolean;
  try {
    const response = await fetch(`${HOMESERVER_URL}/_matrix/client/versions`);
    reachable = response.ok;
  } catch {
    reachable = false;
  }
  if (!reachable) {
    throw new Error(
      `No homeserver answered at ${HOMESERVER_URL}. Start it with \`npm run synapse:up\` ` +
        '(see memory_bank/ops/synapse.md).',
    );
  }
}

/**
 * Logs in as `account`, producing a fresh device on every call.
 *
 * A device per session is deliberate: two sessions for the same user must not
 * share device keys, or the encryption round-trip would prove nothing.
 */
export async function login(account: TestAccount): Promise<TestCredentials> {
  const response = await fetch(`${HOMESERVER_URL}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: account.localpart },
      password: account.password,
      initial_device_display_name: 'react-native-matrix integration suite',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Login failed for ${account.userId}: HTTP ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as {
    user_id: string;
    access_token: string;
    device_id: string;
  };

  return {
    baseUrl: HOMESERVER_URL,
    accessToken: body.access_token,
    userId: body.user_id,
    deviceId: body.device_id,
  };
}
