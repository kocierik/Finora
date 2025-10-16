import { ThemedText } from '@/components/themed-text'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'

export function Card({ children, style, variant = 'default' }: PropsWithChildren<{ 
  style?: any; 
  variant?: 'default' | 'elevated' | 'subtle';
}>) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  
  const cardStyle = [
    styles.card,
    isDark && styles.cardDark,
    variant === 'elevated' && styles.cardElevated,
    variant === 'subtle' && styles.cardSubtle,
    style
  ]
  
  return (
    <View style={cardStyle}>
      {children}
    </View>
  )
}

export function KPI({ label, value, accent = '#4e8ef7' }: { label: string; value: string; accent?: string }) {
  return (
    <View style={[styles.kpi, { borderColor: accent }]}> 
      <View style={{ gap: 4 }}>
        <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>{label}</ThemedText>
        <ThemedText type="title" style={{ fontSize: 18 }}>{value}</ThemedText>
      </View>
    </View>
  )
}

function shade(hex: string, amount: number) {
  // expects #rrggbb
  const c = hex.replace('#', '')
  const num = parseInt(c, 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  const mix = (v: number) => Math.round(v + (amount >= 0 ? (255 - v) * amount : v * amount))
  const nr = mix(r)
  const ng = mix(g)
  const nb = mix(b)
  return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.colors.background.elevated,
    borderRadius: Brand.borderRadius.lg,
    borderWidth: 1,
    borderColor: Brand.colors.glass.medium,
    padding: Brand.spacing.lg,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardDark: {
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
    borderColor: UI_CONSTANTS.GLASS_BORDER_SM,
  },
  cardElevated: {
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardSubtle: {
    backgroundColor: UI_CONSTANTS.GLASS_BG_XS,
    borderColor: UI_CONSTANTS.GLASS_BORDER_XS,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  kpi: {
    borderRadius: Brand.borderRadius.md,
    padding: Brand.spacing.md,
    borderWidth: 1,
    borderColor: Brand.colors.glass.light,
    backgroundColor: UI_CONSTANTS.GLASS_BG_XS,
  }
})


