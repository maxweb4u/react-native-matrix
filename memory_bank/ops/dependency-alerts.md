---
title: Dependency Alerts
doc_kind: ops
doc_function: canonical
purpose: 'How to fix Dependabot and npm audit alerts in the root and example lockfiles and the example Gemfile, and which alerts are known to be unfixable.'
derived_from:
  - ../engineering/dependency-policy.md
canonical_for:
  - dependency_alert_triage
status: active
---
# Dependency Alerts

Dependabot scans three manifests: `package-lock.json`, `example/package-lock.json` and `example/Gemfile` with its `Gemfile.lock`. `npm audit` sees only the first two. Every package involved is tooling: none reaches the published artifact, which has no runtime dependencies (see [dependency-policy.md](../engineering/dependency-policy.md)). Alerts are hygiene, not consumer risk.

## npm lockfiles

- **Do not run `npm audit fix` in the root.** Even without `--force` it re-resolves far beyond the vulnerable package. On 2026-10-14, to fix one transitive package it moved jest 30.5.0→30.5.2, glob 10→13 and picomatch 2→4, and added 98 entries and removed 137. Update the affected packages by name with `npm update <names…>` instead and review the lockfile diff structurally.
- **The Metro family moves as a unit.** `metro`, every `metro-*` package and `ob1` pin each other to exact versions (for example, `metro-symbolicate` requires `metro-source-map 0.87.0`), so name all fifteen in one `npm update`.
- **In `example/`, `npm update <names>` can silently report "up to date"** even when newer in-range versions exist and there are no overrides. Workaround: delete those entries (including nested `…/node_modules/<name>/…` paths) from `example/package-lock.json` and run `npm install --ignore-scripts`. npm re-resolves only what was removed.
- **`example/node_modules` lags its lockfile** after Dependabot PRs are merged, because nobody runs an install there. Run `npm ci` in `example/` before trusting lint or bundle results. After that, Metro may need the watchman reset described in [development.md](development.md#example-application).
- Verify a lockfile change with `npm run verify` in the root, and with `npm run lint` plus a production bundle (`npx react-native bundle --platform ios --dev false …`) in `example/`.

## RubyGems (example/Gemfile)

The React Native template pins `concurrent-ruby '< 1.3.4'`. concurrent-ruby 1.3.5 stopped loading `logger`, and activesupport releases that relied on it crash on load with `NameError: uninitialized constant ActiveSupport::LoggerThreadSafeLevel::Logger`. This reproduced with activesupport 7.0.8.4 + concurrent-ruby 1.3.7. The two gems therefore move together.

Since 2026-10-16 the example requires Ruby ≥ 3.1 so that every RubyGems alert can close:

- `activesupport '>= 7.2.3.1', '< 8'`. 7.2.3.1 fixes GHSA-cg4j-q9v8-6v38, GHSA-89vf-4333-qx8v and GHSA-2j26-frm8-cmj9 and needs Ruby 3.1. It loads `logger` itself, so the concurrent-ruby cap is no longer needed. `< 8` mirrors cocoapods-core's own cap and keeps out the 8.0/8.1 releases that predate the same fixes.
- `concurrent-ruby '>= 1.3.7'`. This fixes GHSA-h8w8-99g7-qmvj, GHSA-wv3x-4vxv-whpp and GHSA-6wx8-w4f5-wwcr.

Do not restore the template's pins when regenerating the example from a newer React Native template.

## Known unfixable alerts

As of 2026-10-17:

| Package | Advisory | Why it stays |
|-|-|-|
| `braces` ≤ 3.0.3 | GHSA-vfj7-8cjw-p6xm (high) | 3.0.3 is the latest release. Reached through `micromatch` in Metro and Jest tooling |
| `sprintf-js` ≤ 1.1.3 | GHSA-hp3w-g68c-fv3c (moderate) | Every release is affected. Reached through `argparse@1` in root Jest tooling |

npm's suggested fixes for these (`react-native@0.72.17`, `jest@25`) are downgrades. Ignore them, and dismiss the alerts as a tolerable risk.
