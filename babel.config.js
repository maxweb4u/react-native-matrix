module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    test: {
      // Jest evaluates modules in a CommonJS VM where a real `import()` throws
      // ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG. matrix-js-sdk loads the
      // Rust crypto backend exactly that way, so without this the integration
      // suite cannot initialise encryption at all. Metro handles dynamic
      // imports natively, so this is scoped to the test environment.
      plugins: [
        '@babel/plugin-transform-dynamic-import',
        // matrix-js-sdk 42 re-exports namespaces (`export * as ContentHelpers`)
        // from its compiled entry point. Standard ES2020, but the React Native
        // preset carries no plugin that lowers it, so the CommonJS transform
        // rejects the file. Unlike the dynamic-import plugin above this is not
        // a test-only workaround: measured on 0.87, Metro fails the same way,
        // so consuming applications need it in their own babel.config.js too.
        // It is listed in the README requirements and set in example/.
        '@babel/plugin-transform-export-namespace-from',
      ],
    },
  },
};
