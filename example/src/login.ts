import type {SessionCredentials} from 'react-native-matrix';

/**
 * Password login.
 *
 * Login, registration, and SSO are deliberately out of scope for the library:
 * every application already has its own identity flow, and a chat component
 * that insists on owning login is a component you cannot adopt. The library
 * takes credentials; obtaining them is this file's job, and it is short.
 */
export async function login(
  baseUrl: string,
  user: string,
  password: string,
): Promise<SessionCredentials> {
  const response = await fetch(`${baseUrl}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: {type: 'm.id.user', user},
      password,
      initial_device_display_name: 'react-native-matrix example',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Login failed (HTTP ${response.status}). ${detail}`);
  }

  const body = (await response.json()) as {
    user_id: string;
    access_token: string;
    device_id: string;
  };

  return {
    baseUrl,
    accessToken: body.access_token,
    userId: body.user_id,
    // Carried through because encryption keys belong to a device: without it
    // the session cannot enable crypto at all.
    deviceId: body.device_id,
  };
}
