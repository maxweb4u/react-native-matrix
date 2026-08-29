import { describeCryptoFailure, missingCryptoRequirement } from '../../core/cryptoSupport';
import { CryptoUnavailableError } from '../../core/errors';
import {
  assertCryptoSupport,
  cryptoUnavailableReason,
  engineCryptoLimitation,
  isCryptoSupported,
} from '../assertCryptoSupport';

/** Removes WebAssembly for one test, the way an old Hermes build presents. */
function withoutWebAssembly(body: () => void): void {
  const original = globalThis.WebAssembly;
  // @ts-expect-error deleting a global is the point of the test
  delete globalThis.WebAssembly;
  try {
    body();
  } finally {
    globalThis.WebAssembly = original;
  }
}

describe('missingCryptoRequirement', () => {
  it('accepts an engine with WebAssembly and a device ID', () => {
    expect(missingCryptoRequirement('DEVICEID')).toBeNull();
  });

  it('names the missing device ID', () => {
    expect(missingCryptoRequirement(undefined)).toMatch(/deviceId/);
  });

  it('reports the engine before the device ID', () => {
    withoutWebAssembly(() => {
      // Both are missing here. The engine is not something the caller can fix,
      // so naming the device ID first would send a developer down a dead end.
      expect(missingCryptoRequirement(undefined)).toMatch(/WebAssembly/);
    });
  });
});

describe('assertCryptoSupport', () => {
  it('passes silently when everything is in place', () => {
    expect(() => assertCryptoSupport({ deviceId: 'DEVICEID' })).not.toThrow();
    expect(isCryptoSupported({ deviceId: 'DEVICEID' })).toBe(true);
  });

  it('throws a named, actionable error when the device ID is missing', () => {
    // SC-10.
    expect(() => assertCryptoSupport({})).toThrow(CryptoUnavailableError);
    expect(() => assertCryptoSupport({})).toThrow(/deviceId/);
    // The message must say what to install and where it works.
    expect(() => assertCryptoSupport({})).toThrow(/matrix-sdk-crypto-wasm/);
    expect(isCryptoSupported({})).toBe(false);
  });

  it('throws when the engine has no WebAssembly', () => {
    withoutWebAssembly(() => {
      expect(() => assertCryptoSupport({ deviceId: 'DEVICEID' })).toThrow(/WebAssembly/);
      expect(isCryptoSupported({ deviceId: 'DEVICEID' })).toBe(false);
    });
  });
});

describe('describeCryptoFailure', () => {
  it('recognises a missing backend package', () => {
    expect(
      describeCryptoFailure(new Error("Cannot find module '@matrix-org/matrix-sdk-crypto-wasm'")),
    ).toMatch(/matrix-sdk-crypto-wasm could not be loaded/);
  });

  it('recognises a WebAssembly instantiation failure', () => {
    expect(describeCryptoFailure(new Error('WebAssembly.instantiate failed'))).toMatch(
      /WebAssembly crypto backend/,
    );
  });

  it('keeps the original message for anything else', () => {
    // An unrecognised failure must not be flattened into a generic sentence:
    // the actual message is the only clue the developer has.
    expect(describeCryptoFailure(new Error('disk quota exceeded'))).toContain(
      'disk quota exceeded',
    );
  });

  it('survives a non-Error throw', () => {
    expect(describeCryptoFailure('something odd')).toContain('something odd');
  });
});

describe('cryptoUnavailableReason', () => {
  it('is null when encryption can start', () => {
    expect(cryptoUnavailableReason({ deviceId: 'DEVICEID' })).toBeNull();
  });

  it('gives a reason a UI can display, not just false', () => {
    // The point of BL-6: a control that silently does nothing is the defect
    // FM-1 forbids. The host needs the words, not a boolean.
    expect(cryptoUnavailableReason({ deviceId: undefined })).toMatch(/deviceId/);
  });
});

describe('engineCryptoLimitation', () => {
  it('is null on an engine with WebAssembly, with no credentials needed', () => {
    expect(engineCryptoLimitation()).toBeNull();
  });

  it('names WebAssembly when the engine cannot run crypto at all', () => {
    withoutWebAssembly(() => {
      expect(engineCryptoLimitation()).toMatch(/WebAssembly/);
    });
  });

  it('ignores the device ID, so a sign-in screen can call it before login', () => {
    // missingCryptoRequirement(undefined) reports the device ID; this must
    // not, or every pre-login screen would show the wrong reason.
    expect(engineCryptoLimitation()).toBeNull();
    expect(cryptoUnavailableReason({ deviceId: undefined })).not.toBeNull();
  });
});
