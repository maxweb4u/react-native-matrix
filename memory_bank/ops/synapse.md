---
doc_kind: ops
doc_function: canonical
purpose: The local Synapse homeserver used by integration tests and the example application.
derived_from:
  - development.md
status: active
canonical_for:
  - test_homeserver_lifecycle
  - test_accounts
  - test_homeserver_settings
---

# Synapse

Integration tests run against a real homeserver rather than a mock, because the behaviour they exist to prove — sync ordering, relation aggregation, authenticated media, encryption — is exactly the behaviour a mock would have to invent.

## Lifecycle

| Command | Effect |
|-|-|
| `npm run synapse:up` | Generates the config on first run, starts the container, waits for health, registers the test accounts |
| `npm run synapse:down` | Stops the container, keeps the data |
| `npm run synapse:reset` | Stops and deletes all data, including the database and uploaded media |
| `./scripts/synapse.sh logs` | Follows the container log |

The server listens on `http://localhost:8008` with server name `localhost`.

`up` is idempotent: running it against a warm server re-checks health and leaves existing accounts alone.

## Test accounts

| User ID | Password |
|-|-|
| `@alice:localhost` | `alice-password` |
| `@bob:localhost` | `bob-password` |

Two accounts is the minimum for the behaviour under test: a message must be sent by one user and received by another, and encryption needs two devices to exchange keys. Tests create their own rooms and never assume a shared fixture room, so they can run in any order.

## Settings that differ from production

`docker/synapse/overrides.yaml` is appended to the generated config. It disables rate limiting, disables presence, allows registration with a shared secret, and raises the upload limit. Several of these are unsafe on a public server and exist purely so a burst of test traffic behaves deterministically. The file documents each one inline.

## Failure modes

| Symptom | Cause |
|-|-|
| `docker is installed but not running` | Docker Desktop is not started |
| Health check times out | Port 8008 is taken; check with `lsof -i :8008` |
| Tests fail with `M_FORBIDDEN` after a code change to auth | Stale data from an earlier schema; run `npm run synapse:reset` |
| Encryption tests fail on a warm server | Device keys from a previous run; `reset` clears them |
