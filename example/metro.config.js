const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// The app consumes the library from source in the repository above it, so
// Metro has to watch that folder and resolve the library's peer dependencies
// to *this* app's copies. Two copies of React or react-native produce hook
// errors that look like application bugs and are not.
const root = path.resolve(__dirname, '..');

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
  resolver: {
    // No `unstable_enablePackageExports` here any more: Metro 0.87, which
    // ships with React Native 0.87, enables package exports by default.
    // Applications on React Native below 0.81 still have to set it, or
    // `@matrix-org/matrix-sdk-crypto-wasm` — which declares `exports` and no
    // `main`, and which matrix-js-sdk imports unconditionally — fails to
    // resolve and takes the whole bundle with it.

    extraNodeModules: {
      // The package root, not `<root>/src`: Metro resolves the root through
      // the package's own `exports`, which publishes `.` and `./crypto` and
      // no `./src` subpath. Pointing at `src` made every bundle print three
      // "not listed in the exports" warnings and fall back to file-based
      // resolution. The `react-native` condition in `exports` maps both
      // entry points back to source, so the app still runs from source.
      'react-native-matrix': root,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      'matrix-js-sdk': path.resolve(__dirname, 'node_modules/matrix-js-sdk'),
    },

    // The repository root keeps its own node_modules for test tooling. Left
    // visible, Metro finds a second React, react-native, and matrix-js-sdk
    // there — `extraNodeModules` is only consulted when normal resolution
    // fails, so hiding these is what makes the mapping above take effect.
    blockList: [
      new RegExp(`${path.resolve(root, 'node_modules', 'react')}/.*`),
      new RegExp(`${path.resolve(root, 'node_modules', 'react-native')}/.*`),
      new RegExp(`${path.resolve(root, 'node_modules', 'matrix-js-sdk')}/.*`),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
