/**
 * GroAurum Design System tokens — JS mirror of tokens.css.
 * Web apps should import `@groaurum/ui/tokens.css` for runtime CSS vars.
 * React Native can import this module for color/spacing parity later.
 */

export const colors = {
  primary: '#1a8d49',
  primaryDark: '#0b5345',
  primarySoft: '#e8f6ee',
  accent: '#a8d44a',
  accentSoft: '#f3f9e8',
  bg: '#f7faf8',
  surface: '#ffffff',
  surfaceMuted: '#eef4f0',
  text: '#0f1f18',
  textSecondary: '#4f6358',
  textMuted: '#84968c',
  border: '#dce8e0',
  danger: '#c62828',
  dangerSoft: '#fdecec',
  warning: '#b7791f',
  warningSoft: '#fef6e8',
  success: '#1a8d49',
  overlay: 'rgba(15, 31, 24, 0.45)',
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 16,
  4: 24,
  5: 32,
  6: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(15, 31, 24, 0.04)',
  md: '0 4px 12px rgba(15, 31, 24, 0.08)',
  lg: '0 12px 32px rgba(15, 31, 24, 0.12)',
} as const;

export const typography = {
  fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  sizeXs: 11,
  sizeSm: 12,
  sizeMd: 13,
  sizeBase: 14,
  sizeLg: 16,
  sizeXl: 22,
  size2xl: 28,
  weightRegular: 400,
  weightSemi: 600,
  weightBold: 700,
} as const;

export const iconSize = {
  sm: 14,
  md: 18,
  lg: 24,
} as const;

export const layout = {
  sidebarWidth: 240,
  topnavHeight: 56,
} as const;
