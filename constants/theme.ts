/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

import { Brand } from './branding';

const tintColorLight = '#0a7ea4';
const tintColorDark = Brand.colors.primary.cyan; // Cyan neon accent

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: Brand.colors.text.primary,
    background: Brand.colors.background.deep,
    tint: tintColorDark,
    icon: Brand.colors.text.muted,
    tabIconDefault: Brand.colors.text.muted,
    tabIconSelected: tintColorDark,
  },
};

// Premium dark theme colors - Using new branding system
export const DarkTheme = {
  background: {
    primary: Brand.colors.background.deep,
    secondary: Brand.colors.background.base,
    tertiary: Brand.colors.background.elevated,
    card: Brand.colors.background.card,
  },
  text: {
    primary: Brand.colors.text.primary,
    secondary: Brand.colors.text.secondary,
    tertiary: Brand.colors.text.tertiary,
    muted: Brand.colors.text.muted,
  },
  accent: {
    primary: Brand.colors.primary.cyan,
    secondary: Brand.colors.primary.teal,
    tertiary: Brand.colors.primary.magenta,
    danger: Brand.colors.semantic.danger,
    warning: Brand.colors.semantic.warning,
    success: Brand.colors.semantic.success,
  },
  border: {
    light: Brand.colors.glass.light,
    medium: Brand.colors.glass.medium,
    heavy: Brand.colors.glass.heavy,
  },
  glow: {
    primary: Brand.colors.glow.cyan,
    secondary: Brand.colors.glow.teal,
    tertiary: Brand.colors.glow.magenta,
    success: Brand.colors.glow.success,
    danger: Brand.colors.glow.danger,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
