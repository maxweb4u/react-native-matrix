module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // matrix-js-sdk 42 re-exports namespaces (`export * as ContentHelpers`) from
  // its compiled entry point. That is standard ES2020, but the React Native
  // preset carries no plugin that lowers it, so Metro's CommonJS transform
  // rejects the file and the bundle fails before the app ever starts. Every
  // application using this library on matrix-js-sdk 42 needs this plugin.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
