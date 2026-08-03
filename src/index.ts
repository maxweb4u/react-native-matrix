/**
 * Public API.
 *
 * Everything exported here is a published contract: adding is a minor
 * release, changing or removing is a major one. Internal modules stay
 * unexported even when they would be useful, because exporting makes them
 * permanent.
 *
 * See memory_bank/engineering/architecture.md#public-api-surface.
 */

// Session and errors
export { MatrixSession, type SessionEvents } from './core/MatrixSession';
export {
  AdapterMissingError,
  CryptoUnavailableError,
  MatrixLibError,
  MatrixRequestError,
  RoomNotFoundError,
  SessionNotReadyError,
} from './core/errors';

// Media helpers
export {
  isMxcUri,
  mediaFetchHeaders,
  type MediaUrlOptions,
  mxcImageSource,
  mxcToHttpUrl,
  parseMxcUri,
  type ParsedMxcUri,
} from './core/mxc';

// React layer
export * from './react';

// Default components
export * from './components';

// View models and helpers consumers need when rendering their own UI
export { buildMemberSummary, buildRoomSummary, sortRoomSummaries } from './timeline/roomSummary';
export {
  formatDayLabel,
  formatDuration,
  formatListTimestamp,
  formatMessageTime,
  isDifferentDay,
} from './utils/datetime';
export { formatBytes, initials, truncateFileName } from './utils/format';

// Types
export * from './types';
