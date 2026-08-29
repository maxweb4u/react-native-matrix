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
  HostRequirementError,
  MatrixLibError,
  MatrixRequestError,
  RoomNotFoundError,
  SessionNotReadyError,
} from './core/errors';

// Host environment: checked automatically by `start()`, exported so an
// application can check before it builds a session.
export {
  type HostRequirement,
  isHostSupported,
  missingHostRequirement,
} from './core/hostSupport';

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
export * from './push';
export * from './types';
