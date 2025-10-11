import { ThemedText } from '@/components/themed-text'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { LinearGradient } from 'expo-linear-gradient'
import { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'

export function Card({ children, style, glow }: PropsWithChildren<{ style?: any; glow?: string }>) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  
  return (
    <View style={[styles.cardWrapper, style]}>
      <LinearGradient
        colors={isDark 
          ? ['rgba(20, 20, 30, 0.95)', 'rgba(15, 15, 25, 0.9)']
          : ['#ffffff', '#f9fafb']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, isDark && styles.cardDark]}
      >
        {glow && (
          <View style={[styles.glow, { backgroundColor: glow }]} />
        )}
        {children}
      </LinearGradient>
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
  cardWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  cardDark: {
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: 'rgba(6, 182, 212, 0.4)',
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.4,
  },
  kpi: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  }
})


