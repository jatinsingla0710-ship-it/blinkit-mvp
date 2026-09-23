export const theme = {
  colors: {
    /** Blinkit-style brand yellow */
    yellow: '#F8CB46',
    yellowSoft: '#FFF4C4',
    /** ADD / cart / success (Blinkit green) */
    primary: '#318616',
    primaryDark: '#25670F',
    primarySoft: '#EAF6E4',
    accent: '#F8CB46',
    accentSoft: '#FFF8DC',
    background: '#F4F6FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F2F2F2',
    text: '#1C1C1C',
    textSecondary: '#4F4F4F',
    textMuted: '#828282',
    border: '#E8E8E8',
    danger: '#C62828',
    dangerSoft: '#FDECEC',
    success: '#318616',
    warning: '#B7791F',
    brandBlack: '#1C1C1C',
    overlay: 'rgba(28, 28, 28, 0.45)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  font: {
    brand: 28,
    title: 22,
    subtitle: 17,
    body: 15,
    caption: 13,
    small: 11,
  },
} as const;

export type Theme = typeof theme;
