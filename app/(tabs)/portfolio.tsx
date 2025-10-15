import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { fetchInvestments, parseInvestmentsFile, upsertInvestments } from '@/services/portfolio'
import { Investment } from '@/types'
import { useFocusEffect } from '@react-navigation/native'
import * as DocumentPicker from 'expo-document-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native'

export default function PortfolioScreen() {
  const { user, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [lastCount, setLastCount] = useState<number | null>(null)
  const [stats, setStats] = useState<{ totalCost: number; totalMarket?: number; pnl?: number; pnlPct?: number } | null>(null)
  const [allocation, setAllocation] = useState<{ name: string; value: number }[]>([])
  const [holdings, setHoldings] = useState<Investment[]>([])
  const [totals, setTotals] = useState<{ invested: number; market: number; pnl: number; pnlPct: number } | null>(null)
  const [hideBalances, setHideBalances] = useState(false)
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current

  // Auth guard - redirect if not logged in
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Caricamento...</ThemedText>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>Accesso non autorizzato</ThemedText>
        <ThemedText style={styles.errorSubtext}>Effettua il login per continuare</ThemedText>
      </View>
    )
  }

  async function computeTotals(inv: Investment[]) {
    if (!inv || inv.length === 0) {
      setTotals(null)
      return
    }
    let invested = 0
    let market = 0
    for (const i of inv) {
      const cost = i.cost_value != null ? Number(i.cost_value) : (i.quantity || 0) * (i.average_price || 0)
      const mkt = i.market_value_eur != null ? Number(i.market_value_eur) : (i.quantity || 0) * (i.average_price || 0)
      invested += cost
      market += mkt
    }
    const pnl = market - invested
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
    setTotals({ invested, market, pnl, pnlPct })
  }

  const onImport = async () => {
    if (!user) return
    setBusy(true)
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
      if (res.canceled || !res.assets?.[0]?.uri) return
      const uri = res.assets[0].uri
      const items = await parseInvestmentsFile(uri, user.id)
      if (!items || items.length === 0) {
        alert('Nessuna riga importata. Controlla che il file abbia intestazioni compatibili e numeri nel formato corretto.')
      }
      const { error } = await upsertInvestments(items)
      if (error) throw error
      setLastCount(items.length)
      // refresh from DB after import
      const { data } = await fetchInvestments(user.id)
      setHoldings(data)
      // derive quick stats if CSV contains columns Valore di carico / Valore di mercato
      const totalCost = sumNumbers(items as any, ['Valore di carico'])
      const totalMkt = sumNumbers(items as any, ['Valore di mercato', 'Valore di mercato €'])
      if (totalCost && totalMkt) {
        const pnl = totalMkt - totalCost
        const pnlPct = (pnl / totalCost) * 100
        setStats({ totalCost, totalMarket: totalMkt, pnl, pnlPct })
      }
      // build allocation by ticker based on quantity * average_price when totals are missing
      const byTicker: Record<string, number> = {}
      for (const it of items) {
        const val = (it.quantity || 0) * (it.average_price || 0)
        byTicker[it.ticker] = (byTicker[it.ticker] ?? 0) + val
      }
      const alloc = Object.entries(byTicker).map(([name, value]) => ({ name, value }))
      setAllocation(alloc)
      await computeTotals(items)
    } catch (e: any) {
      alert(`Errore import: ${e?.message ?? 'sconosciuto'}`)
    } finally {
      setBusy(false)
    }
  }

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await fetchInvestments(user.id)
      setHoldings(data)
      await computeTotals(data)
    } catch (error) {
      console.error('[Portfolio] Error loading data:', error)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Focus effect to reload data when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim1, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim2, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#0a0a0f', '#141419', '#0f0f14']}
        style={styles.backgroundGradient}
      />
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Logo size="md" variant="glow" />
              <View style={styles.headerText}>
                <ThemedText style={styles.headerTitle}>Portafoglio</ThemedText>
                <ThemedText style={styles.headerSubtitle}>Gestisci i tuoi investimenti</ThemedText>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable 
                style={styles.hideButton}
                onPress={() => setHideBalances(!hideBalances)}
              >
                <ThemedText style={styles.hideButtonText}>
                  {hideBalances ? '👁️' : '🙈'}
                </ThemedText>
              </Pressable>
              <Pressable 
                style={styles.loadButton}
                onPress={onImport}
                disabled={busy}
              >
                <LinearGradient
                  colors={busy ? [Brand.colors.text.tertiary, Brand.colors.text.muted] : [Brand.colors.primary.cyan, Brand.colors.primary.teal]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loadButtonGradient}
                >
                  <ThemedText style={styles.loadButtonText}>
                    {busy ? '⏳' : '📁'}
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* KPI Cards */}
        {totals && (
          <Animated.View 
            style={[
              styles.kpiContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim1 }]
              }
            ]}
          >
            <Pressable style={styles.kpiCard}>
              <LinearGradient
                colors={UI_CONSTANTS.GRADIENT_PROFIT_POS as any}
                style={styles.kpiGradient}
              >
                <ThemedText style={styles.kpiLabel}>Totale Investito</ThemedText>
                <ThemedText style={styles.kpiValue}>
                  {hideBalances ? '••••••' : `€${totals.invested.toFixed(2)}`}
                </ThemedText>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.kpiCard}>
              <LinearGradient
                colors={UI_CONSTANTS.GRADIENT_PROFIT_POS as any}
                style={styles.kpiGradient}
              >
                <ThemedText style={styles.kpiLabel}>Valore Attuale</ThemedText>
                <ThemedText style={styles.kpiValue}>
                  {hideBalances ? '••••••' : `€${totals.market.toFixed(2)}`}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {totals && (
          <Animated.View 
            style={[
              styles.kpiContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim2 }]
              }
            ]}
          >
            <Pressable style={styles.kpiCard}>
              <LinearGradient
                colors={totals.pnl >= 0 ? (UI_CONSTANTS.GRADIENT_PROFIT_POS as any) : (UI_CONSTANTS.GRADIENT_PROFIT_NEG as any)}
                style={styles.kpiGradient}
              >
                <ThemedText style={styles.kpiLabel}>Varianza</ThemedText>
                <ThemedText style={[styles.kpiValue, { color: totals.pnl >= 0 ? Brand.colors.semantic.success : Brand.colors.semantic.danger }]}>
                  {hideBalances ? '••••••' : `€${totals.pnl.toFixed(2)}`}
                </ThemedText>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.kpiCard}>
              <LinearGradient
                colors={totals.pnl >= 0 ? (UI_CONSTANTS.GRADIENT_PROFIT_POS as any) : (UI_CONSTANTS.GRADIENT_PROFIT_NEG as any)}
                style={styles.kpiGradient}
              >
                <ThemedText style={styles.kpiLabel}>Varianza %</ThemedText>
                <ThemedText style={[styles.kpiValue, { color: totals.pnl >= 0 ? Brand.colors.semantic.success : Brand.colors.semantic.danger }]}>
                  {hideBalances ? '••••••' : `${totals.pnlPct.toFixed(2)}%`}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Import Status */}
        {lastCount != null && (
          <Animated.View 
            style={[
              styles.statusSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Card style={styles.statusCard} glow="rgba(6, 182, 212, 0.1)">
              <ThemedText style={styles.statusText}>
                📊 Importati: {lastCount} investimenti
              </ThemedText>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.colors.background.deep,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: Brand.colors.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hideButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideButtonText: {
    fontSize: 18,
  },
  loadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Brand.colors.glow.cyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  loadButtonGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Brand.colors.glow.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  kpiGradient: {
    padding: 20,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  statusSection: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  statusCard: {
    padding: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  holdingsSection: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  holdingsCard: {
    padding: 20,
    marginBottom: 16,
  },
  holdingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    marginBottom: 16,
  },
  holdingsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  dangerButtonText: {
    color: Brand.colors.semantic.danger,
  },
  holdingsList: {
    gap: 12,
  },
  holdingCard: {
    padding: 16,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  holdingTicker: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  holdingDate: {
    fontSize: 12,
    color: Brand.colors.text.secondary,
  },
  holdingTitle: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    marginBottom: 12,
  },
  holdingBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chartSection: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  chartCard: {
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.colors.background.deep,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.colors.background.deep,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.colors.semantic.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 16,
    fontWeight: '400',
    color: Brand.colors.text.secondary,
    textAlign: 'center',
  },
})

function sumNumbers(items: any[], keys: string[]) {
  const vals = items
    .map((r) => {
      for (const k of keys) {
        if (r[k] != null && String(r[k]).trim() !== '') return parseItNumber(r[k])
      }
      return 0
    })
  return vals.reduce((s, n) => s + (isNaN(n) ? 0 : n), 0)
}

function parseItNumber(value: any): number {
  if (typeof value === 'number') return value
  let s = String(value).trim()
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, '')
  } else {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? NaN : n
}

const palette = ['#4e8ef7', '#2a9d8f', '#6a4c93', '#00b4d8', '#f77f00', '#e76f51', '#f94144']


