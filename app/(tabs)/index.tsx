import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { Brand } from '@/constants/branding';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import { syncPendingExpenses } from '@/services/expense-sync';
import { fetchExpenses } from '@/services/expenses';
import { logger } from '@/services/logger';
import { fetchInvestments } from '@/services/portfolio';
import { Expense } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, Dimensions, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
  const { t, language } = useSettings()
  const { user, signOut, loading } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [dbCategories, setDbCategories] = useState<{ name: string; icon?: string; color?: string }[]>([])
  const [portfolioPoints, setPortfolioPoints] = useState<{ x: string; y: number }[]>([])
  const [kpis, setKpis] = useState<{ totalInvested: number; totalMarket?: number; monthExpenses: number } | null>(null)
  const [hideBalances, setHideBalances] = useState(false)
  const [userDisplayName, setUserDisplayName] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newCategory, setNewCategory] = useState('Other')
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [toast, setToast] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  // Category edit modal for recent transactions
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Expense | null>(null)
  // Recurring fields
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('monthly')
  const [recurringOccurrences, setRecurringOccurrences] = useState<string>('6')
  const [recurringInfinite, setRecurringInfinite] = useState<boolean>(false)

  // Animation values - MUST be before any conditional returns
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current

  // Load data function - MUST be before any conditional returns
  const loadData = useCallback(async () => {
      if (!user) return
    
    // Test log per verificare che il logger funzioni
    if (logger && logger.info) {
      logger.info('Home screen loadData started', { userId: user.id, timestamp: Date.now() }, 'Home')
    }
    
    // Sincronizza le spese pendenti dalle notifiche Google Wallet
    if (logger && logger.info) {
      logger.info('Syncing pending expenses from notifications', { userId: user.id }, 'Home')
    }
    console.log('[Home] 🔄 Syncing pending expenses from notifications...')
    const syncResult = await syncPendingExpenses(user.id)
    if (syncResult.synced > 0) {
      if (logger && logger.info) {
        logger.info(`Synced ${syncResult.synced} new expenses from Google Wallet`, { synced: syncResult.synced }, 'Home')
      }
      console.log(`[Home] ✅ Synced ${syncResult.synced} new expenses from Google Wallet`)
    }
    
      const [{ data: inv }, { data: exp }, { data: profile }] = await Promise.all([
        fetchInvestments(user.id),
        fetchExpenses(user.id),
        supabase.from('profiles').select('display_name, categories_config').eq('id', user.id).maybeSingle(),
      ])
      setExpenses(exp)
      
      // Carica il nome del profilo
      if (profile?.display_name) {
        setUserDisplayName(profile.display_name)
      }
      // Carica le categorie salvate dall'utente
      const cats = (profile?.categories_config as any[]) || []
      const normalizedCats = cats
        .filter(Boolean)
        .map((c: any) => ({
          name: (c?.name || '').toString(),
          icon: c?.icon || undefined,
          color: c?.color || undefined,
        }))
      setDbCategories(normalizedCats)
      
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
    // Test log per verificare che il logger funzioni
    if (logger && logger.info) {
      logger.info('Home screen mounted', { timestamp: Date.now() }, 'Home')
    }
    
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

  // Realtime refresh: device events and Supabase changes (payments/new expenses)
  useEffect(() => {
    if (!user) return
    const sub = DeviceEventEmitter.addListener('expenses:externalUpdate', () => {
      loadData()
    })
    const channel = supabase
      .channel(`realtime-expenses-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'expenses',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadData()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'expenses',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadData()
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'expenses',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      try { sub.remove() } catch {}
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [user?.id, loadData])

  // Auth guard - redirect if not logged in
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

  // Durante logout/redirect mostra caricamento
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

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
  const userName = userDisplayName || user?.email?.split('@')[0] || 'Utente'
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return t('good_morning')
    if (hour < 18) return t('good_afternoon')
    return t('good_evening')
  })()

  const translateCategoryName = (name: string) => {
    const key = (name || '').toLowerCase()
    if (language === 'it') {
      switch (key) {
        case 'other': return 'Altro'
        case 'transport': return 'Trasporti'
        case 'grocery': return 'Spesa'
        case 'shopping': return 'Shopping'
        case 'night life': return 'Vita notturna'
        case 'travel': return 'Viaggi'
        default: return name
      }
    }
    return name
  }

  const availableCategories = (dbCategories?.length ? dbCategories : [
    { name: 'Other', color: '#10b981' },
    { name: 'Transport', color: '#06b6d4' },
    { name: 'Grocery', color: '#8b5cf6' },
    { name: 'Shopping', color: '#f59e0b' },
    { name: 'Night Life', color: '#ef4444' },
    { name: 'Travel', color: '#3b82f6' },
  ])

  const getCategoryInfo = (name?: string | null) => {
    if (!name) return null
    const key = name.toLowerCase()
    const found = availableCategories.find(c => (c.name || '').toLowerCase() === key)
    return found || null
  }

  const openRecentCategoryModal = (tx: Expense) => {
    setSelectedTx(tx)
    setShowCategoryModal(true)
  }

  const handleSelectRecentCategory = async (categoryName: string) => {
    if (!user || !selectedTx) return
    try {
      const merchant = selectedTx.merchant
      // Update DB for all transactions of same merchant
      const { error } = await supabase
        .from('expenses')
        .update({ category: categoryName.toLowerCase() })
        .eq('user_id', user.id)
        .eq('merchant', merchant)
      if (error) throw error

      // Update local state
      setExpenses(prev => prev.map(it =>
        it.merchant === merchant ? { ...it, category: categoryName.toLowerCase() } : it
      ))

      // Notify other screens
      DeviceEventEmitter.emit('expenses:externalUpdate')
    } catch (e) {
      console.log('[Home] Error updating category for merchant', e)
    } finally {
      setShowCategoryModal(false)
      setSelectedTx(null)
    }
  }

  // Ensure consistent ordering client-side as a fallback
  const sortedExpenses = useMemo(() => {
    const parseDate = (s?: string) => {
      if (!s) return 0
      const parts = s.includes('/') ? s.split('/') : []
      let d: Date
      if (parts.length >= 3) {
        const dd = parseInt(parts[0], 10)
        const mm = parseInt(parts[1], 10) - 1
        const yy = parseInt(parts[2], 10)
        d = new Date(yy, mm, dd)
      } else {
        d = new Date(s)
      }
      return d.getTime()
    }
    return [...expenses].sort((a, b) => {
      const da = parseDate(a.date)
      const db = parseDate(b.date)
      if (db !== da) return db - da
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0
      return cb - ca
    })
  }, [expenses])

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
        {/* Premium Header */}
        <Animated.View 
          style={[
            styles.premiumHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <ThemedText style={styles.premiumGreeting}>
                {greeting}
                {'\n'}
                {userName.charAt(0).toUpperCase() + userName.slice(1)} 👋
              </ThemedText>
          </View>
              <Pressable
              style={styles.premiumProfileButton}
                onPress={() => setHideBalances(!hideBalances)}
              >
              <View style={styles.profileAvatar}>
                <ThemedText style={styles.profileInitial}>
                  {userName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              </Pressable>
          </View>
        </Animated.View>

        {/* Main Balance Card - temporarily hidden */}
        {/* <Animated.View 
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
            <Card style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <View style={styles.balanceIconContainer}>
                  <View style={styles.balanceIcon}>
                    <ThemedText style={styles.balanceIconText}>💰</ThemedText>
                  </View>
                </View>
                <View style={styles.balanceHeaderText}>
              <ThemedText type="heading" style={styles.balanceTitle}>Patrimonio Totale</ThemedText>
                  <ThemedText type="label" style={styles.balanceSubtitle}>{t('financial_settings')}</ThemedText>
                </View>
              </View>

              <View style={styles.balanceContent}>
                <ThemedText type="title" style={styles.balanceAmount}>
                  {hideBalances ? '••••• €' : `${(kpis?.totalInvested ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                  </ThemedText>
                
                <View style={styles.balanceStats}>
                  <View style={styles.balanceStatItem}>
                    <View style={styles.balanceStatBadge}>
                      <ThemedText style={styles.balanceStatIcon}>📈</ThemedText>
                      <ThemedText type="label" style={styles.balanceStatValue}>+2.4%</ThemedText>
                    </View>
                    <ThemedText type="caption" style={styles.balanceStatLabel}>{t('vs_last_month')}</ThemedText>
                    </View>
                  </View>
                </View>
          </Card>
            </Pressable>
          </Animated.View> */}

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
              <Card style={styles.overviewCard}>
                <View style={styles.overviewCardHeader}>
                  <View style={styles.overviewIconContainer}>
                    <View style={[styles.overviewIcon, styles.expenseIcon]}>
                      <ThemedText style={styles.overviewIconText}>💳</ThemedText>
                    </View>
                  </View>
                  <View style={styles.overviewCardText}>
                    <ThemedText type="heading" style={styles.overviewCardTitle}>{t('monthly_expenses')}</ThemedText>
                    <ThemedText type="label" style={styles.overviewCardSubtitle}>{t('this_month')}</ThemedText>
                  </View>
                </View>
                
                <View style={styles.overviewCardContent}>
                  <ThemedText type="subtitle" style={styles.overviewCardAmount}>
                    {hideBalances ? '••••• €' : `${currentMonthExpenses.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                  </ThemedText>
                  
                  <View style={styles.overviewCardFooter}>
                    <View style={[styles.overviewBadge, { 
                      borderColor: expenseDelta >= 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                    }]}>
                      <ThemedText style={[styles.overviewBadgeIcon, { color: expenseDelta >= 0 ? '#ef4444' : '#10b981' }]}>
                        {expenseDelta >= 0 ? '↗' : '↘'}
                      </ThemedText>
                      <ThemedText type="label" style={[styles.overviewBadgeText, { color: expenseDelta >= 0 ? '#ef4444' : '#10b981' }]}>
                        {expenseDelta >= 0 ? '+' : ''}{expenseDeltaPct.toFixed(1)}%
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" style={styles.overviewBadgeLabel}>{t('vs_last_month')}</ThemedText>
                  </View>
                </View>
          </Card>
            </Pressable>
          </Animated.View>

        </View>
        <View style={styles.fabContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && { transform: [{ scale: 0.98 }] }
            ]}
            onPress={() => setShowAddModal(true)}
          >
            <LinearGradient
              colors={[ 'rgba(6,182,212,0.25)', 'rgba(6,182,212,0.08)' ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            />
            <ThemedText style={styles.fabIcon}>＋</ThemedText>
          <ThemedText style={styles.fabLabel}>{t('add_transaction')}</ThemedText>
          </Pressable>
        </View>
        {/* Recent Transactions */}
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            marginTop: 8,
          }}
        >
          <Card style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <ThemedText style={styles.recentTitle}>
                {language === 'it' ? 'Transazioni recenti' : 'Recent transactions'}
              </ThemedText>
              <ThemedText style={styles.recentCount}>
            {/* {Math.min(3, expenses.length)} / {expenses.length} */}
              </ThemedText>
            </View>
            <View style={styles.recentList}>
              {sortedExpenses.slice(0, 3).map((tx, idx) => (
                <View key={tx.id ?? idx} style={styles.recentItem}>
                  <View style={styles.recentLeft}>
                    <View style={styles.recentIcon}>
                      <ThemedText style={styles.recentIconText}>{tx.raw_notification === 'manual' ? '✍️' : '💳'}</ThemedText>
                    </View>
                    <View style={styles.recentTextBlock}>
                      <ThemedText style={styles.recentMerchant} numberOfLines={1}>
                        {tx.merchant || '—'}
                      </ThemedText>
                      <ThemedText style={styles.recentDate}>
                        {new Date(tx.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short' })}
                      </ThemedText>
                    </View>
                  </View>
                  {(() => {
                    const info = getCategoryInfo(tx.category || 'Other')
                    const clr = (info?.color || '#06b6d4')
                    return (
                      <TouchableOpacity
                        onPress={() => openRecentCategoryModal(tx)}
                        style={[styles.homeCategoryBadge, { backgroundColor: `${clr}20`, borderColor: `${clr}40`, marginRight: 10 }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <ThemedText style={[styles.homeCategoryBadgeText, { color: clr }]} numberOfLines={1}>
                          {info?.icon ? `${info.icon} ` : ''}{translateCategoryName(info?.name || (tx.category || 'Other'))}
                        </ThemedText>
                      </TouchableOpacity>
                    )
                  })()}
                  <ThemedText style={[styles.recentAmount, (tx.amount ?? 0) > 0 ? { color: '#ef4444' } : { color: '#22c55e' }]}>
                    {Math.abs(tx.amount ?? 0).toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency: 'EUR' })}
                  </ThemedText>
                </View>
              ))}
              {expenses.length === 0 && (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ThemedText style={{ color: Brand.colors.text.secondary }}>
                    {language === 'it' ? 'Nessuna transazione' : 'No transactions'}
                  </ThemedText>
                </View>
              )}
            </View>
          </Card>
        </Animated.View>

        {/* Add Transaction Floating Button */}


    </ScrollView>

      {/* Add Transaction Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
          <View style={styles.addModalCard}>
            <LinearGradient
              colors={[ 'rgba(6,182,212,0.10)', 'rgba(139,92,246,0.06)', 'transparent' ]}
              style={styles.addModalGradient}
            />
            <View style={styles.addModalHeader}>
              <ThemedText style={styles.addModalTitle}>{t('add_transaction')}</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)} style={styles.addModalClose}>
                <ThemedText style={styles.addModalCloseText}>✕</ThemedText>
              </Pressable>
            </View>
            {!!formError && (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorTitle}>{t('error_prefix')}{formError}</ThemedText>
              </View>
            )}
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('title')}</ThemedText>
              <TextInput
                style={styles.input}
                placeholder={t('title') +' '+ t('transaction')}
                placeholderTextColor="#94a3b8"
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('amount')}</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                value={newAmount}
                onChangeText={setNewAmount}
              />
            </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('category')}</ThemedText>
              <View style={styles.categoryRow}>
                {availableCategories.map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={[styles.categoryChip, newCategory.toLowerCase() === c.name.toLowerCase() && styles.categoryChipActive, { borderColor: (c.color || 'rgba(255,255,255,0.12)') }]}
                    onPress={() => setNewCategory(c.name)}
                  >
                    <ThemedText style={[styles.categoryChipText, newCategory.toLowerCase() === c.name.toLowerCase() && styles.categoryChipTextActive]}>
                      {c.icon ? `${c.icon} ` : ''}{translateCategoryName(c.name)}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('date')}</ThemedText>
              <Pressable style={styles.input} onPress={() => setShowCalendarModal(true)}>
                <ThemedText style={{ color: '#E8EEF8' }}>{newDate}</ThemedText>
              </Pressable>
            </View>

            {/* Recurring Controls */}
            <View style={styles.formRow}>
              <TouchableOpacity
                onPress={() => setIsRecurring(!isRecurring)}
                style={[styles.toggleRow, isRecurring && styles.toggleRowActive]}
              >
                <View style={[styles.toggleIndicator, isRecurring && styles.toggleIndicatorOn]} />
                <ThemedText style={[styles.toggleLabel, isRecurring && styles.toggleLabelActive]}>
                  {t('recurring_transaction')}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {isRecurring && (
              <>
                <View style={styles.formRow}>
                  <ThemedText style={styles.formLabel}>{t('frequency')}</ThemedText>
                  <View style={styles.categoryRow}>
                    {(['monthly','weekly'] as const).map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[styles.categoryChip, recurringFrequency === freq && !recurringInfinite && styles.categoryChipActive]}
                        onPress={() => {
                          setRecurringFrequency(freq);
                          setRecurringInfinite(false);
                        }}
                      >
                        <ThemedText style={[styles.categoryChipText, recurringFrequency === freq && !recurringInfinite && styles.categoryChipTextActive]}>
                          {t(freq)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                    {/* Infinite toggle chip */}
                    <TouchableOpacity
                      key="infinite"
                      style={[styles.categoryChip, recurringInfinite && styles.categoryChipActive]}
                      onPress={() => {
                        setRecurringInfinite(!recurringInfinite);
                        if (!recurringInfinite) {
                          setRecurringFrequency('monthly'); // Reset to default when enabling infinite
                        }
                      }}
                    >
                      <ThemedText style={[styles.categoryChipText, recurringInfinite && styles.categoryChipTextActive]}>
                        {language === 'it' ? 'Senza fine' : 'Never ends'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
                {!recurringInfinite && (
                  <View style={styles.formRow}>
                    <ThemedText style={styles.formLabel}>{t('occurrences')}</ThemedText>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      placeholder="6"
                      placeholderTextColor="#94a3b8"
                      value={recurringOccurrences}
                      onChangeText={setRecurringOccurrences}
                    />
                  </View>
                )}
              </>
            )}

      {/* Calendar Modal */}
      <Modal
        visible={showCalendarModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModalCard}>
            <ThemedText style={styles.addModalTitle}>{t('select_date')}</ThemedText>
            <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                 <Pressable onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} style={styles.calendarNav}>
                    <ThemedText style={styles.calendarNavText}>‹</ThemedText>
                  </Pressable>
                  <ThemedText style={styles.calendarMonthText}>
                    {calendarMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                  </ThemedText>
                 <Pressable
                   disabled={(calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() >= new Date().getMonth())}
                   onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                   style={[styles.calendarNav, (calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() >= new Date().getMonth()) && { opacity: 0.4 }]}
                 >
                    <ThemedText style={styles.calendarNavText}>›</ThemedText>
                  </Pressable>
                </View>
              <View style={styles.calendarWeekRow}>
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                  <ThemedText key={`wd-${i}`} style={styles.calendarWeekText}>{d}</ThemedText>
                ))}
              </View>
                <View style={styles.calendarGrid}>
                  {(() => {
                   const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() || 7
                   const today = new Date()
                   const isCurrentCalendarMonth = calendarMonth.getFullYear() === today.getFullYear() && calendarMonth.getMonth() === today.getMonth()
                   const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
                    const cells: any[] = []
                    const leading = firstDay - 1
                    for (let i = 0; i < leading; i++) cells.push(null)
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
                    return cells.map((day, idx) => {
                      const isEmpty = day === null
                      const yyyy = calendarMonth.getFullYear()
                      const mm = String(calendarMonth.getMonth() + 1).padStart(2, '0')
                      const dd = String(day || 1).padStart(2, '0')
                      const value = `${yyyy}-${mm}-${dd}`
                      const isSelected = !isEmpty && newDate === value
                      const disableFuture = isCurrentCalendarMonth && !isEmpty && day! > today.getDate()
                      return (
                        <TouchableOpacity
                          key={idx}
                          disabled={isEmpty || disableFuture}
                          style={[
                            styles.calendarCell,
                            isSelected && styles.calendarCellSelected,
                            isEmpty && styles.calendarCellEmpty,
                            disableFuture && { opacity: 0.4 }
                          ]}
                        onPress={() => { setNewDate(value); setShowCalendarModal(false) }}
                        >
                          {!isEmpty && (
                            <ThemedText style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>
                              {day}
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      )
                    })
                  })()}
                </View>
            </View>
            <Pressable onPress={() => setShowCalendarModal(false)} style={[styles.submitButton, { marginTop: 12 }]}>
              <ThemedText style={styles.submitButtonText}>{t('close')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.9 }]}
              onPress={async () => {
                if (!user || submitting) return
                setSubmitting(true)
                try {
                  const amountNum = parseFloat((newAmount || '').replace(',', '.'))
                  if (!newTitle || newTitle.trim().length === 0) {
                    setFormError('Titolo obbligatorio')
                    return
                  }
                  if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
                    setFormError('Importo non valido')
                    return
                  }
                  if (!newDate) {
                    setFormError('Data obbligatoria')
                    return
                  }
                  const items: any[] = []
                  if (isRecurring) {
                    const count = recurringInfinite ? 1 : Math.min(36, Math.max(1, parseInt(recurringOccurrences || '1', 10) || 1))
                    const start = new Date(newDate)
                    const groupId = `rec-${user.id}-${Date.now()}`
                    for (let i = 0; i < count; i++) {
                      const d = new Date(start)
                      if (recurringFrequency === 'monthly') {
                        d.setMonth(d.getMonth() + i)
                      } else {
                        d.setDate(d.getDate() + i * 7)
                      }
                      const yyyy = d.getFullYear()
                      const mm = String(d.getMonth() + 1).padStart(2, '0')
                      const dd = String(d.getDate()).padStart(2, '0')
                      items.push({
                        user_id: user.id,
                        amount: amountNum,
                        category: newCategory.toLowerCase(),
                        date: `${yyyy}-${mm}-${dd}`,
                        raw_notification: 'manual',
                        merchant: newTitle || 'Manual',
                        is_recurring: true,
                        recurring_group_id: groupId,
                        recurring_frequency: recurringFrequency,
                        recurring_total_occurrences: recurringInfinite ? null : count,
                        recurring_index: i + 1,
                        recurring_infinite: recurringInfinite,
                      })
                    }
                  } else {
                    items.push({
                      user_id: user.id,
                      amount: amountNum,
                      category: newCategory.toLowerCase(),
                      date: newDate,
                      raw_notification: 'manual',
                      merchant: newTitle || 'Manual',
                      is_recurring: false,
                    })
                  }
                  const { error } = await supabase.from('expenses').insert(items)
                  if (error) {
                    if (logger && logger.error) {
                      logger.error('Failed to save transaction', { error: error.message, items }, 'Home')
                    }
                    setFormError(error.message || 'Errore durante il salvataggio')
                    return
                  }
                  
                  if (logger && logger.info) {
                    logger.info('Transaction saved successfully', { 
                      count: items.length, 
                      isRecurring, 
                      amount: amountNum,
                      category: newCategory 
                    }, 'Home')
                  }
                  
                  await loadData()
                  // notify Expenses screen to refresh immediately
                  DeviceEventEmitter.emit('expenses:externalUpdate')
                  setNewAmount('')
                  setNewCategory('Other')
                  setNewTitle('')
                  setNewDate(new Date().toISOString().split('T')[0])
                  setIsRecurring(false)
                  setRecurringFrequency('monthly')
                  setRecurringOccurrences('6')
                  setRecurringInfinite(false)
                  setFormError(null)
                  setShowAddModal(false)
                  // Show toast
                  setToast({ visible: true, text: 'Transazione aggiunta ✅' })
                  setTimeout(() => setToast({ visible: false, text: '' }), 2000)
                } catch (e: any) {
                  console.log('[Home] add expense error', e)
                  setFormError(e?.message || 'Impossibile salvare la transazione')
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              <ThemedText style={styles.submitButtonText}>{submitting ? t('saving') : t('add_transaction')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {toast.visible && (
        <View style={styles.toast}>
          <ThemedText style={styles.toastText}>{toast.text}</ThemedText>
        </View>
      )}

      {/* Category Selection Modal (reuse styles) */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowCategoryModal(false); setSelectedTx(null) }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModalCard}>
            <View style={styles.addModalHeader}>
              <ThemedText style={styles.addModalTitle}>{t('select_category')}</ThemedText>
              <Pressable onPress={() => { setShowCategoryModal(false); setSelectedTx(null) }} style={styles.addModalClose}>
                <ThemedText style={styles.addModalCloseText}>✕</ThemedText>
              </Pressable>
            </View>
            <View style={styles.categoryRow}>
              {availableCategories.map((c, i) => (
                <TouchableOpacity
                  key={`${c.name}-${i}`}
                  style={[styles.categoryChip, selectedTx?.category?.toLowerCase() === c.name.toLowerCase() && styles.categoryChipActive, { borderColor: (c.color || 'rgba(255,255,255,0.12)') }]}
                  onPress={() => handleSelectRecentCategory(c.name)}
                >
                  <ThemedText style={[styles.categoryChipText, selectedTx?.category?.toLowerCase() === c.name.toLowerCase() && styles.categoryChipTextActive]}>
                    {c.icon ? `${c.icon} ` : ''}{translateCategoryName(c.name)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

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
    paddingBottom: 24,
    marginTop: 24,
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
  // Premium Header
  premiumHeader: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    paddingRight: 16,
  },
  premiumGreeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  monthSummary: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    fontWeight: '500',
    opacity: 0.8,
  },
  premiumProfileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#06b6d4',
  },
  // Main Balance Card
  balanceCardContainer: {
    marginBottom: 24,
  },
  balanceCard: {
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.15)',
    backgroundColor: 'rgba(15, 15, 20, 0.8)',
    minHeight: 160,
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
  overviewContainer: { gap: 12, marginBottom: 12, marginTop: 12 },
  overviewCardContainer: {
    flex: 1,
  },
  overviewCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.1)',
    backgroundColor: 'rgba(15, 15, 20, 0.6)',
    minHeight: 120,
  },
  overviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewIconContainer: {
    marginRight: 16,
  },
  overviewIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  expenseIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  overviewIconText: {
    fontSize: 24,
  },
  overviewCardText: {
    flex: 1,
  },
  overviewCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 4,
  },
  overviewCardSubtitle: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
  },
  overviewCardContent: {
    alignItems: 'center',
    marginTop: 8,
  },
  overviewCardAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.colors.text.primary,
    marginBottom: 16,
  },
  overviewCardFooter: {
    alignItems: 'center',
  },
  overviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  overviewBadgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  overviewBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  overviewBadgeLabel: {
    fontSize: 11,
    color: Brand.colors.text.secondary,
  },
  // Recent transactions styles
  recentCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)'
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentTitle: {
    color: Brand.colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  recentCount: {
    color: Brand.colors.text.tertiary,
    fontSize: 12,
  },
  recentList: {
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)'
  },
  recentIconText: {
    fontSize: 16,
  },
  recentTextBlock: {
    flex: 1,
  },
  recentMerchant: {
    color: Brand.colors.text.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  recentDate: {
    color: Brand.colors.text.secondary,
    fontSize: 12,
  },
  recentAmount: {
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 12,
  },
  homeCategoryBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  homeCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Floating action button
  fabContainer: {
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderColor: 'rgba(6,182,212,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  fabGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  fabIcon: {
    color: '#06b6d4',
    fontSize: 18,
    fontWeight: '700',
  },
  fabLabel: {
    color: '#E8EEF8',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Add modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    backgroundColor: 'rgba(15,15,20,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  addModalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  addModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    zIndex: 1,
  },
  addModalTitle: {
    color: '#E8EEF8',
    fontSize: 18,
    fontWeight: '800',
  },
  addModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addModalCloseText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  formRow: {
    marginTop: 10,
    zIndex: 1,
  },
  formLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#E8EEF8',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toggleRowActive: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderColor: 'rgba(6,182,212,0.35)'
  },
  toggleIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)'
  },
  toggleIndicatorOn: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4'
  },
  toggleLabel: {
    color: '#cbd5e1',
    fontWeight: '700'
  },
  toggleLabelActive: {
    color: '#06b6d4'
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderColor: 'rgba(6,182,212,0.35)',
  },
  categoryChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginRight: 10,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#06b6d4',
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: 'rgba(6,182,212,0.18)',
    borderColor: 'rgba(6,182,212,0.4)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#E8EEF8',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  errorBox: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorTitle: {
    color: '#ef4444',
    fontWeight: '700'
  },
  // Toast
  toast: {
    position: 'absolute',
    bottom: 84,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.10)',
    borderWidth: 0.5,
    borderColor: 'rgba(6,182,212,0.22)',
    alignItems: 'center',
  },
  toastText: {
    color: 'rgba(232, 238, 248, 0.9)',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  // Calendar styles
  calendarContainer: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarNav: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  calendarNavText: {
    color: '#E8EEF8',
    fontWeight: '700',
  },
  calendarMonthText: {
    color: '#E8EEF8',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  calendarWeekText: {
    color: '#94a3b8',
    fontSize: 10,
    width: '14.2857%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginVertical: 2,
    transform: [{ scale: 0.96 }],
  },
  calendarCellEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  calendarCellSelected: {
    backgroundColor: 'rgba(6,182,212,0.18)',
    borderColor: 'rgba(6,182,212,0.4)'
  },
  calendarCellText: {
    color: '#E8EEF8',
    fontWeight: '700',
  },
  calendarCellTextSelected: {
    color: '#06b6d4',
  },
});