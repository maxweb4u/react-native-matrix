/**
 * @format
 */

// Hermes exposes no Web Crypto, and matrix-js-sdk calls
// `globalThis.crypto.getRandomValues` for every transaction ID, so the session
// throws before the first sync without this. It must come before any other
// import.
//
// React Native 0.87 no longer needs a `URL` polyfill: its own `URL` stopped
// appending a trailing slash to the absolute URLs matrix-js-sdk builds, and
// `URLSearchParams` works. Applications on older React Native still need one.
import 'react-native-get-random-values';

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
