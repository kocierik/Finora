import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { syncPendingExpenses } from '@/services/expense-sync';
import { fetchExpenses } from '@/services/expenses';
import { fetchInvestments } from '@/services/portfolio';
import { Expense } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

function sameMonth(dateStr: string, year: number, monthIndex: number) {
  // Accept formats like DD/MM/YYYY or ISO
  if (!dateStr) return false
  const parts = dateStr.includes('/') ? dateStr.split('/') : []
  let d: Date
  if (parts.length >= 3) {
    const dd = parseInt(parts[0], 10)
    const mm = parseInt(parts[1], 10) - 1
    const yy = parseInt(parts[2], 10)
    d = new Date(yy, mm, dd)
  } else {
    d = new Date(dateStr)
  }
  return d.getFullYear() === year && d.getMonth() === monthIndex
}

export default function HomeScreen() {
  const { user, signOut, loading } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [portfolioPoints, setPortfolioPoints] = useState<{ x: string; y: number }[]>([])
  const [kpis, setKpis] = useState<{ totalInvested: number; totalMarket?: number; monthExpenses: number } | null>(null)
  const [hideBalances, setHideBalances] = useState(false)

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
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current

  const loadData = useCallback(async () => {
      if (!user) return
    
    // Sincronizza le spese pendenti dalle notifiche Google Wallet
    console.log('[Home] 🔄 Syncing pending expenses from notifications...')
    const syncResult = await syncPendingExpenses(user.id)
    if (syncResult.synced > 0) {
      console.log(`[Home] ✅ Synced ${syncResult.synced} new expenses from Google Wallet`)
    }
    
      const [{ data: inv }, { data: exp }] = await Promise.all([
        fetchInvestments(user.id),
        fetchExpenses(user.id),
      ])
      setExpenses(exp)
      const totalInvested = inv.reduce((s, it) => s + (it.quantity || 0) * (it.average_price || 0), 0)
      // create a simple 5-point series from cumulative invested (placeholder until price feed)
      const step = Math.max(1, Math.floor(inv.length / 5))
      const series = inv.filter((_, i) => i % step === 0).slice(0, 5).map((it, i) => ({ x: `${i+1}`, y: (it.quantity || 0) * (it.average_price || 0) }))
      setPortfolioPoints(series.length ? series : [{ x: '1', y: totalInvested }])
      const now = new Date()
      const monthExpenses = exp.filter(e => sameMonth(e.date, now.getFullYear(), now.getMonth())).reduce((s, e) => s + (e.amount || 0), 0)
      setKpis({ totalInvested, monthExpenses })
  }, [user?.id])

  // Carica i dati al mount
  useEffect(() => {
    loadData()
    
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim1, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim2, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start()
  }, [loadData])

  // Ricarica i dati ogni volta che la tab diventa attiva
  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [loadData])
  )
  // Ottieni il nome dell'utente o usa un saluto generico
  const userName = user?.email?.split('@')[0] || 'Utente'
  const greeting = getGreeting()

  return (
    <View style={styles.container}>
      {/* Gradient background overlay - Cyan to Magenta */}
      <LinearGradient
        colors={['rgba(6, 182, 212, 0.08)', 'rgba(0, 0, 0, 0)', 'rgba(217, 70, 239, 0.06)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con saluto */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <ThemedText style={styles.greeting}>{greeting}</ThemedText>
            <ThemedText type="title" style={styles.userName}>{userName}</ThemedText>
          </View>
          <View style={styles.headerRight}>
            {/* Toggle balance visibility */}
              <Pressable
                style={styles.eyeButton}
                onPress={() => setHideBalances(!hideBalances)}
              >
                <ThemedText style={styles.eyeIcon}>{hideBalances ? '👁️' : '👁️‍🗨️'}</ThemedText>
              </Pressable>
          </View>
        </Animated.View>

        {/* KPI Cards */}
        <View style={styles.kpiContainer}>
          <Animated.View style={{ transform: [{ scale: scaleAnim1 }] }}>
            <Pressable
              onPressIn={() => Animated.spring(scaleAnim1, { toValue: 0.97, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()}
            >
              <Card style={styles.kpiCard} glow="rgba(6, 182, 212, 0.2)">
                {/* Animated gradient overlay - Cyan */}
                <LinearGradient
                  colors={['rgba(6, 182, 212, 0.12)', 'rgba(20, 184, 166, 0.06)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                />
                <View style={styles.kpiIconContainer}>
                  <View style={[styles.kpiIcon, styles.investmentIcon]}>
                    <ThemedText style={styles.kpiIconText}>💰</ThemedText>
                  </View>
                  <View style={styles.neonLine} />
                </View>
                <View style={styles.kpiContent}>
                  <ThemedText style={styles.kpiLabel}>Patrimonio Investito</ThemedText>
                  <ThemedText type="title" style={styles.kpiValue}>
                    {hideBalances ? '€ •••••' : `€ ${(kpis?.totalInvested ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </ThemedText>
                  <View style={styles.kpiFooter}>
                    <View style={[styles.badge, styles.investmentBadge]}>
                      <View style={styles.badgeDot} />
                      <ThemedText style={styles.badgeText}>Portfolio</ThemedText>
                    </View>
                  </View>
                </View>
          </Card>
            </Pressable>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: scaleAnim2 }] }}>
            <Pressable
              onPressIn={() => Animated.spring(scaleAnim2, { toValue: 0.97, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(scaleAnim2, { toValue: 1, useNativeDriver: true }).start()}
            >
              <Card style={styles.kpiCard} glow="rgba(239, 68, 68, 0.15)">
                <LinearGradient
                  colors={['rgba(239, 68, 68, 0.08)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                />
                <View style={styles.kpiIconContainer}>
                  <View style={[styles.kpiIcon, styles.expenseIcon]}>
                    <ThemedText style={styles.kpiIconText}>💳</ThemedText>
                  </View>
                  <View style={[styles.neonLine, styles.neonLineRed]} />
                </View>
                <View style={styles.kpiContent}>
                  <ThemedText style={styles.kpiLabel}>Spese questo mese</ThemedText>
                  <ThemedText type="title" style={[styles.kpiValue, styles.expenseValue]}>
                    {hideBalances ? '€ •••••' : `€ ${(kpis?.monthExpenses ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </ThemedText>
                  <View style={styles.kpiFooter}>
                    <View style={[styles.badge, styles.expenseBadge]}>
                      <View style={[styles.badgeDot, styles.badgeDotRed]} />
                      <ThemedText style={[styles.badgeText, styles.expenseBadgeText]}>Spese</ThemedText>
                    </View>
                  </View>
                </View>
          </Card>
            </Pressable>
          </Animated.View>
        </View>

    </ScrollView>
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
    zIndex: 0,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  contentContainer: {
    paddingHorizontal: 8,
    paddingBottom: 60,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    paddingHorizontal: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greeting: {
    fontSize: 14,
    opacity: 0.5,
    marginBottom: 4,
    fontWeight: '500',
  },
  userName: {
    fontSize: 36,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: -1,
  },
  eyeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  kpiContainer: {
    gap: 20,
    marginBottom: 32,
  },
  kpiCard: {
    padding: 8,
    minHeight: 200,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 36,
    width: '100%',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  kpiIconContainer: {
    position: 'relative',
    marginBottom: 16,
    zIndex: 1,
  },
  kpiIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  investmentIcon: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  expenseIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  kpiIconText: {
    fontSize: 36,
  },
  neonLine: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#06b6d4',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  neonLineRed: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  kpiContent: {
    flex: 1,
    zIndex: 1,
  },
  kpiLabel: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  kpiValue: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 20,
  },
  expenseValue: {
    color: '#ef4444',
  },
  kpiFooter: {
    marginTop: 'auto',
    zIndex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06b6d4',
  },
  badgeDotRed: {
    backgroundColor: '#ef4444',
  },
  investmentBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  expenseBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#06b6d4',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  expenseBadgeText: {
    color: '#ef4444',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8EEF8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 16,
    fontWeight: '400',
    color: '#9ca3af',
    textAlign: 'center',
  },
});
