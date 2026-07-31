/**
 * LexCom Mobile — Design tokens derived from the LexCom web app's dark theme.
 * HSL values from artifacts/lexcom/src/index.css converted to hex.
 */
const colors = {
  dark: {
    // Surfaces
    background: '#0b0d14',      // hsl(230 25% 6%)
    foreground: '#f8fafc',      // hsl(210 40% 98%)
    card: '#13151f',            // hsl(230 25% 10%)
    cardForeground: '#f8fafc',

    // Primary — electric purple
    primary: '#7b5af2',         // hsl(255 85% 65%)
    primaryForeground: '#f8fafc',

    // Secondary — electric blue
    secondary: '#3d7bf0',       // hsl(220 85% 60%)
    secondaryForeground: '#f8fafc',

    // Accent — violet
    accent: '#b440f0',          // hsl(280 85% 60%)
    accentForeground: '#f8fafc',

    // Muted / subtle
    muted: '#1f212e',           // hsl(230 20% 15%)
    mutedForeground: '#94a3b8', // hsl(215 20% 65%)

    // Borders & inputs
    border: '#1f212e',
    input: '#1f212e',

    // Destructive
    destructive: '#7a1f1f',
    destructiveForeground: '#f8fafc',

    // Legacy aliases
    text: '#f8fafc',
    tint: '#7b5af2',
  },

  light: {
    background: '#fafafa',
    foreground: '#13151f',
    card: '#ffffff',
    cardForeground: '#13151f',
    primary: '#6040e0',
    primaryForeground: '#ffffff',
    secondary: '#2b5fd8',
    secondaryForeground: '#ffffff',
    accent: '#8c28d8',
    accentForeground: '#ffffff',
    muted: '#eef0f5',
    mutedForeground: '#6b7280',
    border: '#dde0ea',
    input: '#dde0ea',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    text: '#13151f',
    tint: '#6040e0',
  },

  radius: 12,
};

export default colors;
