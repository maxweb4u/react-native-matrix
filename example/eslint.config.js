const path = require('path');
const {FlatCompat} = require('@eslint/eslintrc');

// The repository root has its own flat config for the library. Without a
// config file here ESLint walks up to it, finds `ignores: ['example/**']`, and
// reports that every file in this app is ignored — so the app needs its own.
//
// `@react-native/eslint-config` is still eslintrc-shaped; FlatCompat loads it
// unchanged, and its plugins resolve from its own folder rather than this one.
const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: path.dirname(require.resolve('@react-native/eslint-config')),
});

module.exports = [
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', 'vendor/**'],
  },
  ...compat.extends('@react-native'),
  {
    // `eslint-plugin-ft-flow`, which `@react-native/eslint-config` pulls in,
    // still calls `context.getAllComments()` — removed in ESLint 9 — and
    // throws as soon as one of its rules is instantiated. This app is
    // TypeScript, so the Flow rules have nothing to check; turning them off
    // keeps them from being loaded at all. Remove this block once React
    // Native ships an ESLint 9-ready config.
    rules: {
      'ft-flow/define-flow-type': 'off',
      'ft-flow/use-flow-type': 'off',
    },
  },
];
