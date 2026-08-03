---
doc_kind: domain
doc_function: canonical
purpose: Rules for resolving, fetching, and uploading Matrix media.
derived_from:
  - matrix-model.md
status: active
canonical_for:
  - media_url_resolution
  - authenticated_media_policy
  - upload_pipeline
---

# Media

## Authenticated media is the default

Current homeservers serve media from the authenticated endpoint (`/_matrix/client/v1/media/...`, MSC3916). Anonymous media URLs are legacy and may be disabled outright.

Every URL is therefore produced by `MatrixClient.mxcUrlToHttp(..., useAuthentication: true)` and fetched with an `Authorization: Bearer` header, supplied by `mediaFetchHeaders`. `mxcImageSource` returns both together because React Native's `<Image>` needs them in one `source` object.

Two rules follow:

1. **Never put the access token in a URL.** 0.0.x appended `access_token` to the query string of every request, where it lands in server logs and proxy caches.
2. **Never hand out a direct media URL.** `allowDirectLinks` stays `false`, so URLs always point at the user's own homeserver.

## Uploads

1. The host application produces a `LocalFile` through an adapter.
2. The file is read as a blob and uploaded with `uploadContent`, which returns an `mxc://` URI.
3. The message event is sent referencing that URI.

A local echo is shown from step 1 using the local file URI, so the attachment appears immediately. `MediaInfo.localUri` carries it until `mxcUri` is available.

## Thumbnails

Images and videos request a thumbnail sized for the bubble rather than the original file. Thumbnail parameters are part of the URL, so a resized render is a new URL, not a client-side downscale.
