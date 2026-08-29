import type { AdapterName } from '../types/adapters';
import type { HostRequirement } from './hostSupport';

/** Base class for every error this library throws deliberately. */
export class MatrixLibError extends Error {
  public constructor(message: string, name: string) {
    super(message);
    this.name = name;
    // Restores the prototype chain when compiled down to ES5 targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a feature needs a platform adapter the host did not provide.
 *
 * The default UI hides affected controls, so reaching this error means the
 * feature was invoked programmatically.
 */
export class AdapterMissingError extends MatrixLibError {
  public readonly adapter: AdapterName;

  public constructor(adapter: AdapterName, feature: string) {
    super(
      `${feature} requires the "${adapter}" adapter. Pass it to MatrixProvider: ` +
        `<MatrixProvider adapters={{ ${adapter}: … }}>. ` +
        `See https://github.com/maxweb4u/react-native-matrix#adapters`,
      'AdapterMissingError',
    );
    this.adapter = adapter;
  }
}

/** Thrown when the session is used before `start()` resolved, or after `stop()`. */
export class SessionNotReadyError extends MatrixLibError {
  public constructor(operation: string) {
    super(
      `Cannot ${operation}: the Matrix session is not running. ` +
        `Await session.start() first and make sure stop() was not called.`,
      'SessionNotReadyError',
    );
  }
}

/**
 * Thrown when an encrypted room is used while the crypto backend is absent.
 *
 * Encryption needs the optional peer dependency
 * `@matrix-org/matrix-sdk-crypto-wasm` and a WebAssembly-capable engine.
 */
export class CryptoUnavailableError extends MatrixLibError {
  public readonly cause: Error | null;

  public constructor(reason: string, cause: Error | null = null) {
    super(
      `End-to-end encryption is unavailable: ${reason}. ` +
        `Install @matrix-org/matrix-sdk-crypto-wasm and run on an engine with ` +
        `WebAssembly. Stock React Native has none as of 0.87, so this needs a ` +
        `WebAssembly-capable engine or a polyfill.`,
      'CryptoUnavailableError',
    );
    this.cause = cause;
  }
}

/**
 * Thrown when the JavaScript engine is missing a global the library needs.
 *
 * This exists because the failure is otherwise illegible. Without
 * `crypto.getRandomValues` the host used to get a bare `TypeError` from inside
 * `matrix-js-sdk`, on its first request rather than at startup, naming neither
 * the missing global nor the package that supplies it.
 *
 * No test environment reproduces it: Node provides the global natively and
 * `jest.setup.ts` installs it where the react-native preset does not. The
 * regression test therefore removes the global on purpose.
 */
export class HostRequirementError extends MatrixLibError {
  /** The missing global, e.g. `crypto.getRandomValues`. */
  public readonly global: string;

  public constructor(requirement: HostRequirement) {
    super(
      `This JavaScript engine has no ${requirement.global}, which ` +
        `react-native-matrix requires: ${requirement.reason}. ` +
        `To fix: ${requirement.fix} ` +
        `See https://github.com/maxweb4u/react-native-matrix#requirements`,
      'HostRequirementError',
    );
    this.global = requirement.global;
  }
}

/** Thrown when a room is requested that the client does not know about. */
export class RoomNotFoundError extends MatrixLibError {
  public readonly roomId: string;

  public constructor(roomId: string) {
    super(
      `Room ${roomId} is not in the client store. It may not be synced yet, ` +
        `or the user may not be a member.`,
      'RoomNotFoundError',
    );
    this.roomId = roomId;
  }
}

/** Wraps a failed homeserver request with the Matrix error code intact. */
export class MatrixRequestError extends MatrixLibError {
  public readonly httpStatus: number | null;
  /** Matrix error code such as `M_FORBIDDEN`, when the server sent one. */
  public readonly errcode: string | null;

  public constructor(message: string, httpStatus: number | null, errcode: string | null) {
    super(message, 'MatrixRequestError');
    this.httpStatus = httpStatus;
    this.errcode = errcode;
  }

  /** Normalizes an unknown throw site into a `MatrixRequestError`. */
  public static from(error: unknown): MatrixRequestError {
    if (error instanceof MatrixRequestError) {
      return error;
    }
    const source = error as { message?: string; httpStatus?: number; errcode?: string };
    return new MatrixRequestError(
      source?.message ?? 'Matrix request failed',
      typeof source?.httpStatus === 'number' ? source.httpStatus : null,
      typeof source?.errcode === 'string' ? source.errcode : null,
    );
  }
}
