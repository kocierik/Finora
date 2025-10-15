/**
 * Finora - Premium Dark Theme Visual Identity
 * Inspired by Apple Wallet, Revolut, and Nubank
 */

export const Brand = {
  name: 'Finora',
  tagline: 'Il tuo futuro finanziario',
  
  colors: {
    // Primary Palette
    primary: {
      cyan: '#06b6d4',      // Main accent - trust & innovation
      teal: '#14b8a6',      // Secondary accent - growth
      magenta: '#d946ef',   // Tertiary accent - premium
      orange: '#f59e0b',    // Warning accent - attention
      yellow: '#eab308',    // Alert accent - caution
    },
    
    // Background Layers
    background: {
      deep: '#0a0a0f',      // Deepest layer
      base: '#0f0f14',      // Base background
      elevated: '#141419',  // Elevated surfaces
      card: '#1a1a24',      // Card background
    },
    
    // Text Hierarchy
    text: {
      primary: '#f8fafc',   // Main text
      secondary: '#cbd5e1', // Secondary text
      tertiary: '#94a3b8',  // Tertiary text
      muted: '#64748b',     // Muted text
    },
    
    // Semantic Colors
    semantic: {
      success: '#10b981',   // Positive values, growth
      warning: '#f59e0b',   // Alerts, attention
      danger: '#ef4444',    // Negative values, expenses
      info: '#3b82f6',      // Information, neutral
    },
    
    // Neon Glows
    glow: {
      cyan: 'rgba(6, 182, 212, 0.4)',
      teal: 'rgba(20, 184, 166, 0.4)',
      magenta: 'rgba(217, 70, 239, 0.4)',
      success: 'rgba(16, 185, 129, 0.4)',
      danger: 'rgba(239, 68, 68, 0.4)',
    },
    
    // Glassmorphism
    glass: {
      light: 'rgba(255, 255, 255, 0.05)',
      medium: 'rgba(255, 255, 255, 0.08)',
      heavy: 'rgba(255, 255, 255, 0.12)',
    },
  },
  
  typography: {
    // Font Families
    fonts: {
      primary: 'SF Pro Display',  // iOS default, clean & modern
      secondary: 'Inter',         // Fallback
      mono: 'SF Mono',           // Numbers & code
    },
    
    // Font Sizes
    sizes: {
      xs: 10,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
      '2xl': 22,
      '3xl': 28,
      '4xl': 36,
      '5xl': 48,
    },
    
    // Font Weights
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    
    // Letter Spacing
    spacing: {
      tighter: -1.5,
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      wider: 1,
      widest: 2,
    },
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  },
  
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    full: 9999,
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: (color: string) => ({
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 0,
    }),
  },
  
  animations: {
    timing: {
      fast: 200,
      normal: 300,
      slow: 500,
      verySlow: 800,
    },
    spring: {
      default: {
        tension: 50,
        friction: 7,
      },
      bouncy: {
        tension: 40,
        friction: 5,
      },
      smooth: {
        tension: 60,
        friction: 9,
      },
    },
  },
  
  iconography: {
    // Icon sizes
    sizes: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 32,
      xl: 40,
      '2xl': 48,
    },
    
    // Icon categories
    categories: {
      portfolio: '💎',
      expenses: '💳',
      income: '💰',
      savings: '🏦',
      investments: '📈',
      analytics: '📊',
      transactions: '🧾',
      wallet: '👛',
      card: '💎',
      growth: '🌱',
      security: '🔐',
      notifications: '🔔',
      settings: '⚙️',
    },
  },
} as const

export type BrandColors = typeof Brand.colors
export type BrandTypography = typeof Brand.typography
export type BrandSpacing = typeof Brand.spacing

// Centralized UI tokens (migrated from constants/ui.ts)
export const UI = {
  RECENT_TRANSACTIONS_LIMIT: 3,
  MODAL_OVERLAY_DARK: 'rgba(0,0,0,0.85)',
  MODAL_OVERLAY_MEDIUM: 'rgba(0,0,0,0.70)',
  // Glass tokens
  GLASS_BG_XS: 'rgba(255,255,255,0.02)',
  GLASS_BG_SM: 'rgba(255,255,255,0.04)',
  GLASS_BG: 'rgba(255,255,255,0.05)',
  GLASS_BG_MD: 'rgba(255,255,255,0.06)',
  GLASS_BORDER_XS: 'rgba(255,255,255,0.04)',
  GLASS_BORDER_SM: 'rgba(255,255,255,0.08)',
  GLASS_BORDER: 'rgba(255,255,255,0.10)',
  GLASS_BORDER_MD: 'rgba(255,255,255,0.12)',
  // Accent cyan helpers
  ACCENT_CYAN_BG: 'rgba(6, 182, 212, 0.12)',
  ACCENT_CYAN_BORDER: 'rgba(6, 182, 212, 0.3)',
  // Radii
  RADIUS_MD: 12,
  RADIUS_LG: 20,
  RADIUS_XL: 24,
  // Hit slop presets
  HIT_SLOP_SMALL: { top: 6, bottom: 6, left: 6, right: 6 } as const,
  HIT_SLOP_MEDIUM: { top: 8, bottom: 8, left: 8, right: 8 } as const,
  HIT_SLOP_LARGE: { top: 12, bottom: 12, left: 12, right: 12 } as const,
  // Chart defaults
  CHART_DEFAULT_COLORS: ['#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#6366f1', '#f97316', '#6b7280'],
  CHART_DEFAULT_ICONS: ['📦', '💳', '🛒', '✈️', '🚗', '🏥', '📚', '⚡', '🎬', '🌃'],
  CHART_GLOW_COLORS: ['rgba(6, 182, 212, 0.15)', 'rgba(139, 92, 246, 0.1)', 'transparent'],
  CHART_BG_OUTER: 'rgba(10, 10, 15, 0.8)',
  CHART_BG_OUTER_STROKE: 'rgba(6, 182, 212, 0.2)',
  CHART_BG_INNER: 'rgba(20, 20, 30, 0.9)',
  CHART_BG_INNER_STROKE: 'rgba(6, 182, 212, 0.3)',
  // Gradients
  GRADIENT_CYAN_BUTTON: ['rgba(6,182,212,0.35)', 'rgba(6,182,212,0.22)'],
  GRADIENT_CYAN_BG_LIGHT: ['rgba(6,182,212,0.25)', 'rgba(6,182,212,0.08)'],
  GRADIENT_CYAN_BG_CARD: ['rgba(6,182,212,0.10)', 'rgba(139,92,246,0.06)', 'transparent'],
  GRADIENT_CYAN_SUBTLE_BG: ['rgba(6, 182, 212, 0.03)', 'transparent', 'rgba(6, 182, 212, 0.02)'],
  GRADIENT_PROFIT_POS: ['rgba(16, 185, 129, 0.1)', 'rgba(20, 184, 166, 0.05)'],
  GRADIENT_PROFIT_NEG: ['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.05)'],
  // Semantic backgrounds/borders
  MAGENTA_BG: 'rgba(217, 70, 239, 0.1)',
  MAGENTA_BORDER: 'rgba(217, 70, 239, 0.2)',
  DANGER_BG: 'rgba(239, 68, 68, 0.1)',
  DANGER_BORDER: 'rgba(239, 68, 68, 0.3)',
  SUCCESS_BG: 'rgba(16, 185, 129, 0.12)',
  SUCCESS_BORDER: 'rgba(16, 185, 129, 0.3)',
  SUCCESS_TEXT: '#10b981',
} as const

// App theme mappings (merged from theme.ts)
const tintColorLight = '#0a7ea4'
const tintColorDark = Brand.colors.primary.cyan

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
} as const

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
} as const

import { Platform } from 'react-native'
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
})

