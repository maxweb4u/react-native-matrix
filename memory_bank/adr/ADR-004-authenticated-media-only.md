---
doc_kind: adr
doc_function: canonical
purpose: Record the decision to use authenticated media exclusively and keep tokens out of URLs.
derived_from:
  - ../domain/media.md
status: active
decision_status: accepted
date: 2026-08-02
---

# ADR-004 — Authenticated media only

## Context

0.0.x handled media two ways, both broken.

For downloads it built URLs by hand against the legacy `/_matrix/media/r0/download` endpoint and sent the access token in a non-standard `accessToken` header that homeservers ignore. It worked only while the media repository allowed anonymous access. Authenticated media (MSC3916) is on by default in current Synapse, so those downloads now fail.

For every other request it appended `access_token` to the query string, where it is recorded in server access logs, proxy caches, and browser history.

## Decision

1. Media URLs are produced exclusively by `MatrixClient.mxcUrlToHttp` with `useAuthentication: true`, never assembled by hand.
2. Fetches carry `Authorization: Bearer <token>`, supplied by `mediaFetchHeaders`. `mxcImageSource` returns URL and headers together, because React Native's `<Image>` needs both in one `source`.
3. `allowDirectLinks` is `false`, so URLs always point at the user's own homeserver.
4. The access token never appears in a URL, in any code path.

## Consequences

**Positive.** Media works against current homeservers. Tokens stay out of logs. Media requests cannot be redirected to a third-party server chosen by a message sender.

**Negative.** Consumers cannot pass a bare URL to an arbitrary image component; they need the headers too. `mxcImageSource` exists to make that a single call.

**Follow-on.** Any code constructing a `/_matrix/media` path by hand is a defect. `parseMxcUri` deliberately returns only the components, with no URL building.
