import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react';

import { defaultLabels, type MatrixLabels } from './labels';
import { defaultTheme, type MatrixTheme, type MatrixThemeOverride, mergeTheme } from './theme';

export interface MatrixUi {
  theme: MatrixTheme;
  labels: MatrixLabels;
  /** BCP 47 tag used for dates and times, e.g. `de-DE`. */
  locale: string;
}

const fallback: MatrixUi = { theme: defaultTheme, labels: defaultLabels, locale: 'en' };

const MatrixUiContext = createContext<MatrixUi | null>(null);

export interface MatrixUiProviderProps {
  children: ReactNode;
  theme?: MatrixThemeOverride;
  /** Partial: anything not supplied keeps its English default. */
  labels?: Partial<MatrixLabels>;
  locale?: string;
}

/**
 * Supplies theme, labels, and locale to the default components.
 *
 * Optional by design. Without it the components render with English labels and
 * the default palette, so a consumer can see the chat working before deciding
 * how to style it.
 */
export function MatrixUiProvider({
  children,
  theme,
  labels,
  locale,
}: MatrixUiProviderProps): ReactElement {
  const value = useMemo<MatrixUi>(
    () => ({
      theme: mergeTheme(defaultTheme, theme),
      labels: labels ? { ...defaultLabels, ...labels } : defaultLabels,
      locale: locale ?? 'en',
    }),
    [theme, labels, locale],
  );

  return <MatrixUiContext.Provider value={value}>{children}</MatrixUiContext.Provider>;
}

/** Theme, labels, and locale. Falls back to the defaults outside a provider. */
export function useMatrixUi(): MatrixUi {
  return useContext(MatrixUiContext) ?? fallback;
}
