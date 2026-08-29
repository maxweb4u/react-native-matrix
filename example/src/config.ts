import {Platform} from 'react-native';

/**
 * Where the local Synapse from `docker/synapse` is reachable *from the device
 * running this app*, which is not the same address in every case:
 *
 * | Target | Address |
 * |-|-|
 * | iOS simulator | `localhost` — it shares the Mac's network stack |
 * | Android emulator | `10.0.2.2` — `localhost` there is the emulator itself |
 * | Physical device | The Mac's LAN address, e.g. `192.168.1.10` |
 *
 * A physical device is the case the defaults cannot cover, so the sign-in
 * screen exposes this as an editable field rather than making it a rebuild.
 * `ipconfig getifaddr en0` prints the address to type in.
 *
 * On Android a USB cable is easier than the LAN: `adb reverse tcp:8008
 * tcp:8008` makes `localhost:8008` on the device reach the Mac.
 *
 * See memory_bank/ops/synapse.md.
 */
export const DEFAULT_HOMESERVER_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8008' : 'http://localhost:8008';

/** Accounts seeded by `npm run synapse:up`. */
export const SEEDED_ACCOUNTS = [
  {user: 'alice', password: 'alice-password'},
  {user: 'bob', password: 'bob-password'},
] as const;
