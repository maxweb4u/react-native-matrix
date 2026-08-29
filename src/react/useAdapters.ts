import { useCallback, useMemo } from 'react';

import { AdapterMissingError } from '../core/errors';
import type { AdapterName, MatrixAdapters } from '../types';
import { useMatrixContext } from './context';

export interface UseAdaptersResult {
  adapters: MatrixAdapters;
  /** True when the host supplied this adapter. Drives which controls render. */
  has: (name: AdapterName) => boolean;
  /**
   * Returns the adapter or throws {@link AdapterMissingError}.
   * Use for a feature the user just invoked; use {@link has} to decide whether
   * to offer it in the first place.
   */
  require: <K extends AdapterName>(name: K, feature: string) => NonNullable<MatrixAdapters[K]>;
}

/**
 * Access to the host-supplied platform adapters.
 *
 * A missing adapter hides its control and throws a named error when the
 * feature is invoked anyway. It is never a silent no-op, which is what makes a
 * partially wired app feel broken rather than limited.
 *
 * See memory_bank/engineering/adapters.md.
 */
export function useAdapters(): UseAdaptersResult {
  const { session } = useMatrixContext('useAdapters');
  const adapters = session.adapters;

  const has = useCallback((name: AdapterName) => adapters[name] !== undefined, [adapters]);

  const require = useCallback(
    <K extends AdapterName>(name: K, feature: string): NonNullable<MatrixAdapters[K]> => {
      const adapter = adapters[name];
      if (!adapter) {
        throw new AdapterMissingError(name, feature);
      }
      return adapter as NonNullable<MatrixAdapters[K]>;
    },
    [adapters],
  );

  return useMemo(() => ({ adapters, has, require }), [adapters, has, require]);
}
