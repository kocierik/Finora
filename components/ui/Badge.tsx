import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { StyleSheet, View } from 'react-native';

export function Badge({ label, accent }: { label: string; accent?: string }) {
  const bg = useThemeColor({}, 'background')
  return (
    <View style={[styles.badge, { backgroundColor: accent ? withAlpha(accent, 0.12) : shade(bg, 0.06), borderColor: accent ? withAlpha(accent, 0.35) : 'rgba(255,255,255,0.06)' }]}>
      <ThemedText style={{ color: accent ?? '#E8EEF8', fontSize: 12 }}>{label}</ThemedText>
    </View>
  )
}

function withAlpha(hex: string, alpha: number) {
  // #rrggbb
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function shade(hex: string, amount: number) {
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
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
})


