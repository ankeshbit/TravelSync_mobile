export const Theme = {
  colors: {
    // Charcoal / Carbon / Graphite Palette
    background: '#111210', // graphite.950 (App background)
    sidebar: '#141512', // graphite.900 (Sidebar / input background)
    surface: '#1B1C19', // graphite.850 (Card surface)
    surfaceElevated: '#22231F', // graphite.800 (Elevated surface, icon containers)
    surfaceHover: '#292A25', // graphite.750 (Pressed / hover surface)
    inputBackground: '#141512', // Input background

    // Borders
    border: '#30312C', // graphite.700 (Subtle border)
    borderStrong: '#414239', // graphite.600 (Card hover / strong border)
    borderFocus: '#A7A99A', // Sage accent border focus

    // Typography
    textPrimary: '#D5D3CA', // graphite.300 (Primary text)
    textSecondary: '#A5A69B', // graphite.400 (Secondary text)
    textMuted: '#85867C', // graphite.500 (Muted / placeholder text)

    // Primary Accent (Sage)
    accent: '#A7A99A', // Primary button & accent color
    accentHover: '#B9BBAA', // Accent hover/pressed
    accentText: '#171813', // High-contrast text on accent buttons
    accentMuted: 'rgba(167, 169, 154, 0.15)',

    // Google Brand Colors
    googleBlue: '#4285F4',
    googleGreen: '#34A853',
    googleYellow: '#FBBC05',
    googleRed: '#EA4335',

    // Status Colors (Matching Website)
    status: {
      success: '#86A98B',
      successBg: 'rgba(134, 169, 139, 0.12)',
      warning: '#C4A36B',
      warningBg: 'rgba(196, 163, 107, 0.12)',
      error: '#C77F78',
      errorBg: 'rgba(199, 127, 120, 0.15)',
      errorBorder: 'rgba(199, 127, 120, 0.3)',
      info: '#98A6A0',
      infoBg: 'rgba(152, 166, 160, 0.12)',
    },
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
} as const;

export const Spacing = {
  ...Theme.spacing,
  half: 4,
  one: 8,
  two: 12,
  three: 16,
  four: 20,
  five: 24,
  six: 28,
  seven: 32,
  eight: 40,
} as const;

export const Fonts = {
  regular: 'System',
  bold: 'System',
  semiBold: 'System',
  medium: 'System',
  mono: 'monospace',
} as const;

export type ThemeColor = 'text' | 'background' | 'backgroundElement' | 'backgroundSelected' | 'textSecondary';

export const Colors: Record<'light' | 'dark', Record<ThemeColor, string>> = {
  dark: {
    text: Theme.colors.textPrimary,
    background: Theme.colors.background,
    backgroundElement: Theme.colors.surface,
    backgroundSelected: Theme.colors.surfaceElevated,
    textSecondary: Theme.colors.textSecondary,
  },
  light: {
    text: Theme.colors.textPrimary,
    background: Theme.colors.background,
    backgroundElement: Theme.colors.surface,
    backgroundSelected: Theme.colors.surfaceElevated,
    textSecondary: Theme.colors.textSecondary,
  },
};
