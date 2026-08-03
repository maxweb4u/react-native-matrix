# Contributing

## Setup

Node 20 or later. Docker is needed only for the integration suite.

```sh
npm install
npm run verify
```

## Commands

| Command | Purpose |
|-|-|
| `npm run verify` | Typecheck, lint, unit tests, and the memory-bank audit. Run before opening a pull request |
| `npm test` | Unit tests only |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run build` | CommonJS, ESM, and declarations into `lib/` |
| `npm run synapse:up` / `:down` / `:reset` | Local homeserver for integration tests |
| `npm run test:integration` | Integration suite against the local homeserver |
| `npm run check:docs` | Memory-bank index audit on its own |

## Before you write code

Read [`memory_bank/engineering/README.md`](memory_bank/engineering/README.md).
Three rules decide most review comments:

1. **No runtime dependencies.** `dependencies` in `package.json` stays empty.
   Anything needing a native module is an adapter. Adding a dependency requires
   an ADR clearing the conditions in
   [`dependency-policy.md`](memory_bank/engineering/dependency-policy.md).
2. **Remote data is hostile.** Event content is written by other users. Parse it
   through the whitelist in `src/timeline/parseContent.ts`; never assign remote
   keys onto an object.
3. **Failures are explicit.** A missing adapter, an absent crypto backend, or an
   unsynced room throws a named error from `src/core/errors.ts` that says what
   to do about it. Silent no-ops are defects.

## Tests

Every behaviour change gets a test. Every bug fix gets a regression test with a
comment naming the original defect — this is how the rewrite keeps 0.0.x's
history from repeating. Details:
[`testing-policy.md`](memory_bank/engineering/testing-policy.md).

Unit tests live beside the code in `__tests__/` and never touch the network.
Integration tests live in `integration/` and run against the local Synapse.

## Documentation

The memory bank is part of the change, not a follow-up. When you alter
behaviour that a document owns, update that document in the same pull request;
`npm run check:docs` verifies frontmatter, links, and index reachability.

Architecture decisions go in [`memory_bank/adr/`](memory_bank/adr/README.md),
one decision per record, including the cost you accepted.

## Commits and pull requests

Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
Breaking changes carry `!` and a `BREAKING CHANGE:` footer naming the affected
export. Keep pull requests focused on one change, and make sure `npm run verify`
passes before requesting review.

## Code of Conduct

Be respectful and constructive. Report unacceptable behaviour through a GitHub
issue or directly to the maintainer.
