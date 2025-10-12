/**
 * Finora - Premium Dark Theme Visual Identity
 * Inspired by Apple Wallet, Revolut, and Nubank
 */

export const Brand = {
  name: 'Finora',
  tagline: 'Your Financial Future',
  
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

