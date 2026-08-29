/**
 * Visual tokens for the default components.
 *
 * The components are a starting point, not a design system. Everything they
 * draw resolves through these tokens so an application can restyle the whole
 * chat by passing one object, instead of forking the components or fighting
 * them with `style` overrides.
 *
 * See memory_bank/product/vision.md — "replaceable in layers".
 */

export interface MatrixTheme {
  colors: {
    /** Page background behind the conversation. */
    background: string;
    /** Cards, the composer bar, and the chat-list rows. */
    surface: string;
    /** Bubble of a message the local user sent. */
    bubbleOwn: string;
    /** Bubble of a message someone else sent. */
    bubbleOther: string;
    textPrimary: string;
    textSecondary: string;
    /** Text inside an own-message bubble. */
    textOnOwn: string;
    accent: string;
    border: string;
    danger: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number };
  radius: { bubble: number; pill: number };
  fontSize: { caption: number; small: number; body: number; title: number };
  /** Edge length of a member avatar in the conversation. */
  avatarSize: number;
}

export const defaultTheme: MatrixTheme = {
  colors: {
    background: '#ffffff',
    surface: '#f5f6f8',
    bubbleOwn: '#3478f6',
    bubbleOther: '#eceef1',
    textPrimary: '#11161c',
    textSecondary: '#6b7683',
    textOnOwn: '#ffffff',
    accent: '#3478f6',
    border: '#dfe3e8',
    danger: '#d1394a',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  radius: { bubble: 16, pill: 999 },
  fontSize: { caption: 11, small: 13, body: 15, title: 17 },
  avatarSize: 36,
};

/** A partial theme, overridable one token at a time. */
export interface MatrixThemeOverride {
  colors?: Partial<MatrixTheme['colors']>;
  spacing?: Partial<MatrixTheme['spacing']>;
  radius?: Partial<MatrixTheme['radius']>;
  fontSize?: Partial<MatrixTheme['fontSize']>;
  avatarSize?: number;
}

/** Merges an override group by group, so a single colour can be replaced. */
export function mergeTheme(base: MatrixTheme, override?: MatrixThemeOverride): MatrixTheme {
  if (!override) {
    return base;
  }
  return {
    colors: { ...base.colors, ...override.colors },
    spacing: { ...base.spacing, ...override.spacing },
    radius: { ...base.radius, ...override.radius },
    fontSize: { ...base.fontSize, ...override.fontSize },
    avatarSize: override.avatarSize ?? base.avatarSize,
  };
}
