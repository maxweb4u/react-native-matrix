/**
 * Attachment upload and authenticated download.
 *
 * SC-3 is proved here as well as in the unit suite: the unit test shows the
 * URL is built without a token, this one shows the homeserver actually refuses
 * the request without the Authorization header.
 *
 * See memory_bank/domain/media.md.
 */

import type { MatrixSession } from '../src/core/MatrixSession';
import type { RoomTimeline } from '../src/timeline/RoomTimeline';
import { mediaFetchHeaders, mxcToHttpUrl } from '../src/core/mxc';
import { MessageKind } from '../src/types/content';
import type { LocalFile } from '../src/types';
import { ALICE, BOB, requireHomeserver } from './support/homeserver';
import {
  createSharedRoom,
  openTimeline,
  startSession,
  stopEverything,
  waitForItem,
} from './support/harness';

/** A 1×1 transparent PNG, small enough to inline and still a real image. */
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

const attachment: LocalFile = {
  // `sendFile` reads the URI with `fetch`, which handles `data:` here and
  // `file://` / `content://` / `ph://` on a device. No file-system dependency
  // is involved, which is what lets the library ship without one.
  uri: `data:image/png;base64,${PIXEL_PNG_BASE64}`,
  name: 'pixel.png',
  mimeType: 'image/png',
  width: 1,
  height: 1,
};

let alice: MatrixSession;
let bob: MatrixSession;
let roomId: string;
let bobTimeline: RoomTimeline;

beforeAll(async () => {
  await requireHomeserver();
  [alice, bob] = await Promise.all([startSession(ALICE), startSession(BOB)]);
  roomId = await createSharedRoom(alice, bob, { name: 'Media' });
  bobTimeline = openTimeline(bob, roomId);
});

afterAll(() => {
  stopEverything();
});

describe('attachments', () => {
  it('uploads a file and describes it as an image', async () => {
    const eventId = await alice.sendFile(roomId, attachment);

    const item = await waitForItem(
      bobTimeline,
      'bob to receive the attachment',
      (candidate) => candidate.id === eventId,
    );

    expect(item.kind).toBe(MessageKind.Image);
    expect(item.body).toBe('pixel.png');
    expect(item.media?.mxcUri).toMatch(/^mxc:\/\//);
    expect(item.media?.mimeType).toBe('image/png');
    expect(item.media).toMatchObject({ width: 1, height: 1 });
    expect(item.media?.size).toBeGreaterThan(0);
  });

  it('serves the file only from the authenticated endpoint', async () => {
    const eventId = await alice.sendFile(roomId, attachment);
    const item = await waitForItem(
      bobTimeline,
      'bob to receive the attachment',
      (candidate) => candidate.id === eventId,
    );

    const url = mxcToHttpUrl(bob.getClient(), item.media?.mxcUri);
    expect(url).not.toBeNull();

    // SC-3. 0.0.x appended the access token to the query string of every media
    // URL, where each proxy on the path logs it.
    expect(url).not.toContain('access_token');
    expect(url).toContain('/_matrix/client/v1/media/download/');

    const authorized = await fetch(url as string, {
      headers: mediaFetchHeaders(bob.getClient()),
    });
    expect(authorized.status).toBe(200);

    const bytes = new Uint8Array(await authorized.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual(PNG_MAGIC);

    // The same URL without the header must be refused. Without this assertion
    // the test would still pass against a server with anonymous media, which
    // is exactly the configuration 0.0.x accidentally depended on.
    const anonymous = await fetch(url as string);
    expect(anonymous.status).toBe(401);
  });

  it('builds an authenticated thumbnail URL', async () => {
    const eventId = await alice.sendFile(roomId, attachment);
    const item = await waitForItem(
      bobTimeline,
      'bob to receive the attachment',
      (candidate) => candidate.id === eventId,
    );

    const url = mxcToHttpUrl(bob.getClient(), item.media?.mxcUri, {
      thumbnail: { width: 64, height: 64, method: 'scale' },
    });

    expect(url).toContain('/_matrix/client/v1/media/thumbnail/');
    expect(url).toContain('method=scale');
    expect(url).not.toContain('access_token');

    const response = await fetch(url as string, { headers: mediaFetchHeaders(bob.getClient()) });
    expect(response.status).toBe(200);
  });
});
