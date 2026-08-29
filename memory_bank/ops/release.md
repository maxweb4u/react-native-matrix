---
doc_kind: ops
doc_function: canonical
purpose: Versioning rules, publish checklist, and package contents.
derived_from:
  - ../engineering/git-workflow.md
status: active
canonical_for:
  - versioning_rules
  - publish_checklist
  - package_contents
---

# Release

## Versioning

Semantic versioning against the public API defined in [../engineering/architecture.md](../engineering/architecture.md#public-api-surface).

- **Major** — an export is removed or changes shape; an adapter interface gains a required member; the minimum React Native or `matrix-js-sdk` version rises.
- **Minor** — new exports, new optional adapter members, new optional options.
- **Patch** — fixes that keep every signature intact.

While the package is below 1.0.0 the leading zero absorbs one level: what the table calls **major** ships as a minor bump — `0.1.0` to `0.2.0` — and what it calls **minor** and **patch** both ship as a patch. That is what semantic versioning means by `0.x`, and it is why `README.md` tells consumers that `^0.1.0` allows patch releases only. The table applies literally from 1.0.0 onward.

0.1.0 is a deliberate break from the 0.0.x line: different API, different module system, different dependency model. The migration guide in `README.md` is part of that release, not an afterthought. It is released below 1.0.0 because no application other than `example/` has used the API yet; 1.0.0 is the same API once one has.

## Checklist

1. `npm run verify` passes.
2. `npm run synapse:up && npm run test:integration` passes.
3. `cd example && npx react-native bundle --entry-file index.js --platform ios --dev false --bundle-output /dev/null` and the same for `android`. Bundling is the only check that catches a resolver failure; typecheck, lint, and both test suites pass without noticing one. See [../engineering/gotchas.md](../engineering/gotchas.md#packaging).
4. The example app runs on a physical device on **both** platforms against the local homeserver, including the SC-12 keyboard procedure recorded in [../features/FT-001-typescript-rewrite/feature.md](../features/FT-001-typescript-rewrite/feature.md).
5. `CHANGELOG.md` has an entry for the version.
6. The memory bank matches the change ([../dna/lifecycle.md](../dna/lifecycle.md)).
7. `npm publish` — `prepack` rebuilds `lib/` automatically.
8. Tag `v<version>` and push.

## Package contents

The tarball ships `src/` and `lib/` only. `src/` is included because Metro consumes TypeScript directly through the `react-native` export condition, which keeps stack traces readable in a consumer's debugger. Tests, the example app, the memory bank, and Docker files are excluded through the `files` field.

Verify before publishing:

```sh
npm pack --dry-run
```
