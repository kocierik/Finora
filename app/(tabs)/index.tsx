import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { Brand } from '@/constants/branding';
import { useAuth } from '@/context/AuthContext';
import { syncPendingExpenses } from '@/services/expense-sync';
import { fetchExpenses } from '@/services/expenses';
import { fetchInvestments } from '@/services/portfolio';
import { Expense } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

function sameMonth(dateStr: string, year: number, monthIndex: number) {
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

  // Animation values - MUST be before any conditional returns
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

  // Calculate financial data
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1
  const prevYear = curMonth === 0 ? curYear - 1 : curYear

  const currentMonthExpenses = expenses.filter(e => sameMonth(e.date, curYear, curMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const previousMonthExpenses = expenses.filter(e => sameMonth(e.date, prevYear, prevMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const expenseDelta = currentMonthExpenses - previousMonthExpenses
  const expenseDeltaPct = previousMonthExpenses > 0 ? (expenseDelta / previousMonthExpenses) * 100 : 0



  // Get user name
  const userName = user?.email?.split('@')[0] || 'Utente'
  const greeting = getGreeting()

  return (
    <View style={styles.container}>
      {/* Subtle background gradient */}
      <LinearGradient
        colors={['rgba(6, 182, 212, 0.03)', 'transparent', 'rgba(6, 182, 212, 0.02)']}
        locations={[0, 0.5, 1]}
        style={styles.backgroundGradient}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <Animated.View 
          style={[
            styles.topBar,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.topBarLeft}>
            <ThemedText style={styles.appName}>Finora</ThemedText>
            <ThemedText style={styles.greeting}>{greeting} {userName} 👋</ThemedText>
          </View>
          <Pressable
            style={styles.profileButton}
            onPress={() => setHideBalances(!hideBalances)}
          >
            <ThemedText style={styles.profileIcon}>{hideBalances ? '👤' : '👁️'}</ThemedText>
          </Pressable>
        </Animated.View>

        {/* Main Balance Card */}
        <Animated.View 
          style={[
            styles.balanceCardContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim1 }]
            }
          ]}
        >
          <Pressable
            onPressIn={() => Animated.spring(scaleAnim1, { toValue: 0.98, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()}
          >
            <Card style={styles.balanceCard} glow="rgba(6, 182, 212, 0.08)">
              <View style={styles.balanceHeader}>
                <View style={styles.balanceIconContainer}>
                  <View style={styles.balanceIcon}>
                    <ThemedText style={styles.balanceIconText}>💰</ThemedText>
                  </View>
                </View>
                <View style={styles.balanceHeaderText}>
                  <ThemedText style={styles.balanceTitle}>Patrimonio Totale</ThemedText>
                  <ThemedText style={styles.balanceSubtitle}>Investimenti</ThemedText>
                </View>
              </View>

              <View style={styles.balanceContent}>
                <ThemedText style={styles.balanceAmount}>
                  {hideBalances ? '••••• €' : `${(kpis?.totalInvested ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                </ThemedText>
                
                <View style={styles.balanceStats}>
                  <View style={styles.balanceStatItem}>
                    <View style={styles.balanceStatBadge}>
                      <ThemedText style={styles.balanceStatIcon}>📈</ThemedText>
                      <ThemedText style={styles.balanceStatValue}>+2.4%</ThemedText>
                    </View>
                    <ThemedText style={styles.balanceStatLabel}>vs mese scorso</ThemedText>
                  </View>
                </View>
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        {/* Financial Overview Cards */}
        <View style={styles.overviewContainer}>
          {/* Monthly Expenses Card */}
          <Animated.View 
            style={[
              styles.overviewCardContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim2 }]
              }
            ]}
          >
            <Pressable
              onPressIn={() => Animated.spring(scaleAnim2, { toValue: 0.98, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(scaleAnim2, { toValue: 1, useNativeDriver: true }).start()}
            >
              <Card style={styles.overviewCard} glow="rgba(239, 68, 68, 0.06)">
                <View style={styles.overviewCardHeader}>
                  <View style={styles.overviewIconContainer}>
                    <View style={[styles.overviewIcon, styles.expenseIcon]}>
                      <ThemedText style={styles.overviewIconText}>💳</ThemedText>
                    </View>
                  </View>
                  <View style={styles.overviewCardText}>
                    <ThemedText style={styles.overviewCardTitle}>Spese Mensili</ThemedText>
                    <ThemedText style={styles.overviewCardSubtitle}>Questo mese</ThemedText>
                  </View>
                </View>
                
                <View style={styles.overviewCardContent}>
                  <ThemedText style={styles.overviewCardAmount}>
                    {hideBalances ? '••••• €' : `${currentMonthExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                  </ThemedText>
                  
                  <View style={styles.overviewCardFooter}>
                    <View style={[styles.overviewBadge, { 
                      borderColor: expenseDelta >= 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                    }]}>
                      <ThemedText style={[styles.overviewBadgeIcon, { color: expenseDelta >= 0 ? '#ef4444' : '#10b981' }]}>
                        {expenseDelta >= 0 ? '↗' : '↘'}
                      </ThemedText>
                      <ThemedText style={[styles.overviewBadgeText, { color: expenseDelta >= 0 ? '#ef4444' : '#10b981' }]}>
                        {expenseDelta >= 0 ? '+' : ''}{expenseDeltaPct.toFixed(1)}%
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.overviewBadgeLabel}>vs mese scorso</ThemedText>
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
    backgroundColor: '#0a0a0f',
  },
  backgroundGradient: {
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
    paddingHorizontal: 16,
    paddingBottom: 60,
    paddingTop: 48,
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
  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  topBarLeft: {
    flex: 1,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: Brand.colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    fontWeight: '500',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIcon: {
    fontSize: 20,
  },
  // Main Balance Card
  balanceCardContainer: {
    marginBottom: 24,
  },
  balanceCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
    backgroundColor: 'rgba(15, 15, 20, 0.8)',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  balanceIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceIconText: {
    fontSize: 28,
  },
  balanceAccentLine: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#06b6d4',
    borderRadius: 1,
  },
  balanceHeaderText: {
    flex: 1,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 2,
  },
  balanceSubtitle: {
    fontSize: 13,
    color: Brand.colors.text.secondary,
  },
  hideButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideIcon: {
    fontSize: 16,
  },
  balanceContent: {
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: Brand.colors.text.primary,
    letterSpacing: -1,
    marginBottom: 16,
  },
  balanceStats: {
    alignItems: 'center',
  },
  balanceStatItem: {
    alignItems: 'center',
  },
  balanceStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    marginBottom: 4,
  },
  balanceStatIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  balanceStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
  },
  balanceStatLabel: {
    fontSize: 11,
    color: Brand.colors.text.secondary,
  },
  // Overview Cards
  overviewContainer: {
    gap: 16,
    marginBottom: 32,
  },
  overviewCardContainer: {
    flex: 1,
  },
  overviewCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.1)',
    backgroundColor: 'rgba(15, 15, 20, 0.6)',
  },
  overviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewIconContainer: {
    marginRight: 12,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  expenseIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  overviewIconText: {
    fontSize: 20,
  },
  overviewCardText: {
    flex: 1,
  },
  overviewCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 2,
  },
  overviewCardSubtitle: {
    fontSize: 12,
    color: Brand.colors.text.secondary,
  },
  overviewCardContent: {
    alignItems: 'center',
  },
  overviewCardAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Brand.colors.text.primary,
    marginBottom: 12,
  },
  overviewCardFooter: {
    alignItems: 'center',
  },
  overviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  overviewBadgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  overviewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  overviewBadgeLabel: {
    fontSize: 10,
    color: Brand.colors.text.secondary,
  },
});