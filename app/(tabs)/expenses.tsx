import { ExpensesPie } from '@/components/charts/ExpensesPie'
import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { DatePickerModal } from '@/components/ui/DatePickerModal'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import { syncPendingExpenses } from '@/services/expense-sync'
import { calculateActivityPercentage, getExpenseLevel, getExpenseLevelColor, getExpenseLevelText, loadExpenseThresholds, type ExpenseThresholds } from '@/services/expense-thresholds'
import { deleteExpense } from '@/services/expenses'
import { Expense } from '@/types'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, DeviceEventEmitter, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'

export default function ExpensesScreen() {
  const { locale, currency, t, monthlyBudget, language } = useSettings()
  const { user, loading } = useAuth()
  const [items, setItems] = useState<Expense[]>([])
  const [hideBalances, setHideBalances] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Expense | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Expense | null>(null)
  const [autoAssignedCount, setAutoAssignedCount] = useState(0)
  const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0)
  const [expenseThresholds, setExpenseThresholds] = useState<ExpenseThresholds>({ moderate: 1000, high: 1500 })
  const [allMonthItems, setAllMonthItems] = useState<Expense[]>([])
  const [visibleTransactionsCount, setVisibleTransactionsCount] = useState(10)
  // Category history modal state
  const [showCategoryHistoryModal, setShowCategoryHistoryModal] = useState(false)
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState<string | null>(null)
  const [categoryHistory, setCategoryHistory] = useState<Expense[]>([])
  const [categoryHistoryLoading, setCategoryHistoryLoading] = useState(false)
  
  // Month navigation state
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0) // 0 = current month, -1 = previous, 1 = next
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current
  const balanceAnim = useRef(new Animated.Value(0)).current
  
  // Month transition animations
  const monthSlideAnim = useRef(new Animated.Value(0)).current
  const monthFadeAnim = useRef(new Animated.Value(1)).current
  const listAnim = useRef(new Animated.Value(0)).current

  // Note: Do NOT early-return before hooks. Render guards are applied later to keep hook order stable.

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    try {
      // Sincronizza le spese pendenti dalle notifiche Google Wallet
      console.log('[Expenses] 🔄 Syncing pending expenses from notifications...')
      const syncResult = await syncPendingExpenses(user.id)
      if (syncResult.synced > 0) {
        console.log(`[Expenses] ✅ Synced ${syncResult.synced} new expenses from Google Wallet`)
        // Trigger category cards update
        setCategoryUpdateTrigger(prev => prev + 1)
      }
      
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      const sortedItems = (data as Expense[])?.sort((a, b) => {
        // Sort by date descending, then by created_at descending
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        if (dateA.getTime() === dateB.getTime()) {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        }
        return dateB.getTime() - dateA.getTime()
      }) ?? []
      
      // Auto-assign categories for new transactions
      const updatedItems = await autoAssignCategories(sortedItems)
      
      // Debug log
      console.log('Fetched expenses:', {
        total: updatedItems.length,
        withCategories: updatedItems.filter(e => e.category).length,
        categories: [...new Set(updatedItems.map(e => e.category).filter(Boolean))],
        sample: updatedItems.slice(0, 3).map(e => ({ merchant: e.merchant, category: e.category, amount: e.amount }))
      })
      
      setItems(updatedItems)
      
      // Animate balance change
      Animated.sequence([
        Animated.timing(balanceAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(balanceAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()
    } finally {
      setRefreshing(false)
    }
  }, [user?.id])

  const loadExpenseThresholdsData = useCallback(async () => {
    try {
      const thresholds = await loadExpenseThresholds()
      setExpenseThresholds(thresholds)
    } catch (error) {
      console.log('[Expenses] ⚠️  Error loading expense thresholds:', error)
    }
  }, [])

  const loadAllMonthItems = useCallback(async (year: number, month: number) => {
    if (!user) return
    
    try {
      // Calcola il range di date per il mese
      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0) // Ultimo giorno del mese
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]
      
      console.log(`[Expenses] 📅 Loading all items for ${year}-${month + 1} (${startDateStr} to ${endDateStr})`)
      
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false })
      
      if (error) throw error
      
      setAllMonthItems(data || [])
      console.log(`[Expenses] ✅ Loaded ${data?.length || 0} items for month ${year}-${month + 1}`)
    } catch (error: any) {
      console.error('[Expenses] ❌ Error loading month items:', error)
    }
  }, [user?.id])

  useEffect(() => {
    fetchExpenses()
    loadExpenseThresholdsData()
    
    // Entrance animations
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

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchExpenses()
    }, 30000)

    const sub = DeviceEventEmitter.addListener('expenses:externalUpdate', () => {
      console.log('[Expenses] 🔄 External update received, refreshing data...')
      fetchExpenses()
      loadAllMonthItems(curYear, curMonth)
      // Force pie chart update
      setCategoryUpdateTrigger(prev => prev + 1)
    })

    return () => { clearInterval(interval); sub.remove() }
  }, [fetchExpenses])


  // Focus effect to reload data when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchExpenses()
      loadExpenseThresholdsData()
    }, [fetchExpenses, loadExpenseThresholdsData])
  )

  // KPIs
  // Month calculations with navigation support
  const now = new Date()
  const currentDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1)
  const curMonth = currentDate.getMonth()
  const curYear = currentDate.getFullYear()
  const prevMonthDate = new Date(curYear, curMonth - 1, 1)
  const prevMonth = prevMonthDate.getMonth()
  const prevYear = prevMonthDate.getFullYear()
  const monthTotal = items.filter((e) => sameMonth(e.date, curYear, curMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const prevTotal = items.filter((e) => sameMonth(e.date, prevYear, prevMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const delta = monthTotal - prevTotal
  const deltaPct = prevTotal > 0 ? (delta / prevTotal) * 100 : 0

  const monthName = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  // Load all month items when month changes
  useEffect(() => {
    loadAllMonthItems(curYear, curMonth)
    // Reset visible transactions count when month changes
    setVisibleTransactionsCount(10)
  }, [curYear, curMonth, loadAllMonthItems])

  // Filter items for selected month
  const selectedMonthItems = items.filter((e) => sameMonth(e.date, curYear, curMonth))

  // Debug log for month calculation
  console.log('Month calculation:', {
    curYear,
    curMonth,
    prevYear,
    prevMonth,
    monthName,
    now: now.toISOString(),
    monthTotal,
    prevTotal,
    delta,
    deltaPct,
    totalItems: items.length,
    currentMonthItems: items.filter((e) => sameMonth(e.date, curYear, curMonth)).length,
    previousMonthItems: items.filter((e) => sameMonth(e.date, prevYear, prevMonth)).length,
    sampleDates: items.map(e => ({ date: e.date, amount: e.amount })).slice(0, 3)
  })

  // Spending categories
  const categories = [
    { name: 'Night Life', icon: '🌃', amount: 0, color: '#ef4444', percentage: 0 },
    { name: 'Travel', icon: '✈️', amount: 0, color: '#3b82f6', percentage: 0 },
    { name: 'Grocery', icon: '🛒', amount: 0, color: '#8b5cf6', percentage: 0 },
    { name: 'Shopping', icon: '🛍️', amount: 0, color: '#f59e0b', percentage: 0 },
    { name: 'Other', icon: '📦', amount: 0, color: '#10b981', percentage: 0 },
    { name: 'Transport', icon: '🚗', amount: 0, color: '#06b6d4', percentage: 0 },
    { name: 'Healthcare', icon: '🏥', amount: 0, color: '#ec4899', percentage: 0 },
    { name: 'Education', icon: '📚', amount: 0, color: '#6366f1', percentage: 0 },
    { name: 'Utilities', icon: '⚡', amount: 0, color: '#f97316', percentage: 0 },
    { name: 'Entertainment', icon: '🎬', amount: 0, color: '#6b7280', percentage: 0 },
  ]

  // Main categories for selection (reduced set for better UX)
  const mainCategories = [
    { name: 'Other', icon: '📦', amount: 0, color: '#10b981', percentage: 0 },
    { name: 'Transport', icon: '🚗', amount: 0, color: '#06b6d4', percentage: 0 },
    { name: 'Grocery', icon: '🛒', amount: 0, color: '#8b5cf6', percentage: 0 },
    { name: 'Shopping', icon: '🛍️', amount: 0, color: '#f59e0b', percentage: 0 },
    { name: 'Night Life', icon: '🌃', amount: 0, color: '#ef4444', percentage: 0 },
    { name: 'Travel', icon: '✈️', amount: 0, color: '#3b82f6', percentage: 0 },
  ]

  // Available categories for selection (main categories only)
  const availableCategories = mainCategories

  // i18n - category labels by current language
  const translateCategory = (name: string) => {
    if (language !== 'it') return name
    const key = (name || '').toLowerCase()
    switch (key) {
      case 'other': return 'Altro'
      case 'transport': return 'Trasporti'
      case 'grocery': return 'Spesa'
      case 'shopping': return 'Shopping'
      case 'night life': return 'Vita notturna'
      case 'travel': return 'Viaggi'
      case 'healthcare': return 'Sanità'
      case 'education': return 'Istruzione'
      case 'utilities': return 'Utenze'
      case 'entertainment': return 'Intrattenimento'
      default: return name
    }
  }

  // Shorten category label to avoid overlap in badges
  const shortenCategory = (name: string) => {
    const it = translateCategory(name)
    switch (it.toLowerCase()) {
      case 'vita notturna': return 'Notte'
      case 'intrattenimento': return 'Intratt.'
      case 'istruzione': return 'Studio'
      default:
        return it.length > 10 ? it.slice(0, 10) + '…' : it
    }
  }

  // Calculate category spending from real data - use useMemo to make it reactive
  const categoryTotals = useMemo(() => {
    console.log('Recalculating categoryTotals with allMonthItems:', allMonthItems.length)
    
    // Use allMonthItems which already contains all items for the selected month
    const currentMonthItems = allMonthItems
    console.log('Current month items:', currentMonthItems.length)
    console.log('All current month items:', currentMonthItems.map(e => ({ 
      merchant: e.merchant, 
      category: e.category, 
      amount: e.amount, 
      date: e.date 
    })))
    
    return categories.map(cat => {
      const categoryItems = allMonthItems.filter(e => 
        e.category && 
        e.category.toLowerCase() === cat.name.toLowerCase()
      )
      const amount = categoryItems.reduce((sum, e) => sum + (e.amount || 0), 0)
      const percentage = monthTotal > 0 ? (amount / monthTotal) * 100 : 0
      
      // Debug log for all categories
      console.log(`Category ${cat.name} (looking for "${cat.name.toLowerCase()}"):`, {
        categoryItems: categoryItems.length,
        amount,
        percentage,
        allItems: allMonthItems.length,
        monthTotal,
        sampleItems: categoryItems.slice(0, 2).map(e => ({ merchant: e.merchant, category: e.category, amount: e.amount }))
      })
      
      return { ...cat, amount, percentage }
    }).sort((a, b) => b.amount - a.amount)
  }, [allMonthItems, monthTotal, categoryUpdateTrigger])

  const onRefresh = useCallback(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const handleTransactionPress = useCallback((transaction: Expense) => {
    setSelectedTransaction(transaction)
    setShowCategoryModal(true)
  }, [])

  // Category card pulse animation state
  const [pulsingCategory, setPulsingCategory] = useState<string | null>(null)
  const [scalingCategory, setScalingCategory] = useState<string | null>(null)
  const categoryPulseAnim = useRef(new Animated.Value(1)).current
  const categoryScaleAnim = useRef(new Animated.Value(1)).current

  // Pulse a specific category card with a smooth spring animation (uniform intensity)
  const pulseCategoryCard = useCallback((categoryName: string) => {
    setPulsingCategory(categoryName)
    categoryPulseAnim.setValue(1)
    Animated.sequence([
      Animated.spring(categoryPulseAnim, { toValue: 0.96, friction: 4, tension: 5, useNativeDriver: true }),
      Animated.spring(categoryPulseAnim, { toValue: 1, friction: 5, tension: 5, useNativeDriver: true })
    ]).start(() => {
      setPulsingCategory(null)
    })
  }, [categoryPulseAnim])

  // Open category history modal and fetch all-time history for that category
  const openCategoryHistory = useCallback(async (categoryName: string) => {
    if (!user) return
    setSelectedHistoryCategory(categoryName)
    setShowCategoryHistoryModal(true)
    setCategoryHistory([])
    setCategoryHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', categoryName.toLowerCase())
        .order('date', { ascending: false })
      if (error) throw error
      setCategoryHistory((data as any) ?? [])
    } catch (e) {
      console.error('[Expenses] ❌ Error fetching category history', e)
    } finally {
      setCategoryHistoryLoading(false)
    }
  }, [user])

  const handleCategorySelect = useCallback(async (category: string) => {
    if (!selectedTransaction || !user) return

    try {
      // Update all transactions with the same merchant name
      const { error } = await supabase
        .from('expenses')
        .update({ category: category.toLowerCase() })
        .eq('user_id', user.id)
        .eq('merchant', selectedTransaction.merchant)

      if (error) throw error

      // Update local state for all matching transactions
      const updatedItems = items.map(item => 
        item.merchant === selectedTransaction.merchant 
          ? { ...item, category: category.toLowerCase() }
          : item
      )
      
      console.log('Updating categories for merchant:', selectedTransaction.merchant, 'to category:', category)
      console.log('Updated items count:', updatedItems.length)
      console.log('Items with new category:', updatedItems.filter(item => item.merchant === selectedTransaction.merchant).length)
      
      setItems(updatedItems)

      // Update month dataset used by pie chart so it refreshes immediately
      setAllMonthItems(prev => prev.map(item =>
        item.merchant === selectedTransaction.merchant
          ? { ...item, category: category.toLowerCase() }
          : item
      ))

      // Trigger recalculation of memoized category totals
      setCategoryUpdateTrigger(prev => prev + 1)

      setShowCategoryModal(false)
      setSelectedTransaction(null)
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }, [selectedTransaction, user])

  const closeCategoryModal = useCallback(() => {
    setShowCategoryModal(false)
    setSelectedTransaction(null)
  }, [])

  const handleDeleteTransaction = useCallback(async (transaction: Expense) => {
    if (!transaction.id) {
      console.error('Cannot delete transaction without ID')
      return
    }

    setShowConfirmModal(true)
    setTransactionToDelete(transaction)
  }, [])

  // Stop recurring series from a transaction
  const handleStopRecurring = useCallback(async (transaction: Expense) => {
    if (!user || !transaction) return
    try {
      if (!(transaction as any).recurring_group_id) return
      const groupId = (transaction as any).recurring_group_id as string
      const { error } = await supabase
        .from('expenses')
        .update({ recurring_stopped: true })
        .eq('user_id', user.id)
        .eq('recurring_group_id', groupId)
      if (error) throw error
      // Update local state to reflect stopped series
      setItems(prev => prev.map(it =>
        (it as any).recurring_group_id === groupId ? ({ ...it, recurring_stopped: true } as any) : it
      ))
      setAllMonthItems(prev => prev.map(it =>
        (it as any).recurring_group_id === groupId ? ({ ...it, recurring_stopped: true } as any) : it
      ))
      
      // Force pie chart update
      setCategoryUpdateTrigger(prev => prev + 1)
      
      setShowCategoryModal(false)
      setSelectedTransaction(null)
      
      console.log('[Expenses] ✅ Recurring series stopped, pie chart updated')
    } catch (e) {
      console.error('[Expenses] ❌ Error stopping recurring series', e)
    }
  }, [user])

  // Month navigation functions
  const navigateToMonth = useCallback((direction: 'prev' | 'next') => {
    if (isTransitioning) return
    
    const newOffset = direction === 'prev' 
      ? selectedMonthOffset - 1 
      : selectedMonthOffset + 1
    
    // Prevent going beyond current month (offset 0)
    if (newOffset > 0) {
      console.log('Cannot navigate beyond current month')
      return
    }
    
    setIsTransitioning(true)
    
    // Animate out
    Animated.parallel([
      Animated.timing(monthSlideAnim, {
        toValue: direction === 'prev' ? 50 : -50,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(monthFadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Update month
      setSelectedMonthOffset(newOffset)
      
      // Reset animation values
      monthSlideAnim.setValue(direction === 'prev' ? -50 : 50)
      monthFadeAnim.setValue(0.3)
      
      // Animate in
      Animated.parallel([
        Animated.spring(monthSlideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(monthFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsTransitioning(false)
      })
    })
  }, [selectedMonthOffset, isTransitioning, monthSlideAnim, monthFadeAnim])

  const resetToCurrentMonth = useCallback(() => {
    if (selectedMonthOffset === 0) return
    
    setIsTransitioning(true)
    setSelectedMonthOffset(0)
    
    Animated.parallel([
      Animated.spring(monthSlideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(monthFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsTransitioning(false)
    })
  }, [selectedMonthOffset, monthSlideAnim, monthFadeAnim])

  // Date picker functions
  const handleDatePickerSelect = useCallback((offset: number) => {
    if (offset === selectedMonthOffset) return
    
    setIsTransitioning(true)
    
    // Enhanced animation sequence
    const direction = offset > selectedMonthOffset ? -40 : 40
    
    // Phase 1: Slide out and fade
    Animated.parallel([
      Animated.timing(monthSlideAnim, {
        toValue: direction,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(monthFadeAnim, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim1, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Update the month
      setSelectedMonthOffset(offset)
      
      // Phase 2: Reset position and animate in
      monthSlideAnim.setValue(-direction)
      monthFadeAnim.setValue(0.3)
      scaleAnim1.setValue(0.95)
      
      Animated.parallel([
        Animated.spring(monthSlideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(monthFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim1, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsTransitioning(false)
      })
    })
  }, [selectedMonthOffset, monthSlideAnim, monthFadeAnim, scaleAnim1])

  // Pan gesture handler for swipe navigation
  const onPanGestureEvent = useCallback((event: any) => {
    const { translationX, velocityX } = event.nativeEvent
    
    // Only allow horizontal swipes
    if (Math.abs(translationX) > Math.abs(event.nativeEvent.translationY)) {
      monthSlideAnim.setValue(translationX * 0.3) // Dampen the movement
    }
  }, [monthSlideAnim])

  const onPanHandlerStateChange = useCallback((event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent
    
    if (state === State.END) {
      const threshold = 50
      const velocityThreshold = 0.5
      
      // Reset animation
      Animated.spring(monthSlideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start()
      
      // Check if swipe was strong enough
      if (Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold) {
        if (translationX > 0 || velocityX > 0) {
          // Swipe right - go to previous month
          navigateToMonth('prev')
        } else {
          // Swipe left - go to next month
          navigateToMonth('next')
        }
      }
    }
  }, [navigateToMonth, monthSlideAnim])

  // Function to auto-assign categories based on existing merchant categories
  const autoAssignCategories = useCallback(async (transactions: Expense[]) => {
    if (!user) return transactions

    const updatedTransactions = [...transactions]
    const transactionsToUpdate: { id: string; category: string }[] = []

    // Group transactions by merchant
    const merchantCategories = new Map<string, string>()
    
    // First pass: collect existing categories for each merchant
    for (const transaction of updatedTransactions) {
      if (transaction.category && transaction.merchant) {
        merchantCategories.set(transaction.merchant, transaction.category)
      }
    }

    // Second pass: assign categories to transactions without them
    for (let i = 0; i < updatedTransactions.length; i++) {
      const transaction = updatedTransactions[i]
      
      if (!transaction.category && transaction.merchant && merchantCategories.has(transaction.merchant)) {
        const category = merchantCategories.get(transaction.merchant)!
        updatedTransactions[i] = { ...transaction, category }
        transactionsToUpdate.push({ id: transaction.id!, category })
      }
    }

    // Update database for transactions that got auto-assigned categories
    if (transactionsToUpdate.length > 0) {
      try {
        for (const update of transactionsToUpdate) {
          await supabase
            .from('expenses')
            .update({ category: update.category.toLowerCase() })
            .eq('id', update.id)
        }
        console.log(`Auto-assigned categories to ${transactionsToUpdate.length} transactions`)
        setAutoAssignedCount(transactionsToUpdate.length)
        
        // Clear the notification after 3 seconds
        setTimeout(() => {
          setAutoAssignedCount(0)
        }, 3000)
      } catch (error) {
        console.error('Error auto-assigning categories:', error)
      }
    }

    return updatedTransactions
  }, [user])

  // Function to get category for a merchant
  const getMerchantCategory = useCallback((merchant: string) => {
    const transaction = items.find(item => item.merchant === merchant && item.category)
    return transaction?.category
  }, [items])

  // Function to get category info for display
  const getCategoryInfo = useCallback((merchant: string) => {
    const category = getMerchantCategory(merchant)
    const categoryToUse = category || 'Other' // Default to 'Other' if no category
    
    const categoryInfo = availableCategories.find(c => c.name.toLowerCase() === categoryToUse.toLowerCase())
    return categoryInfo ? { ...categoryInfo, name: categoryToUse } : null
  }, [getMerchantCategory])

  if (loading) {
  return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

  // Durante il logout/redirect mostra caricamento invece di errore
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

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
        refreshControl={
          <Animated.View style={{ opacity: refreshing ? 1 : 0 }}>
            <ThemedText style={styles.refreshText}>Aggiornamento...</ThemedText>
          </Animated.View>
        }
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
      
        </Animated.View>

        {/* Auto-assignment notification */}
        {autoAssignedCount > 0 && (
          <Animated.View 
            style={[
              styles.autoAssignNotification,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Card variant="subtle" style={styles.autoAssignCard}>
              <View style={styles.autoAssignContent}>
                <ThemedText style={styles.autoAssignIcon}>✨</ThemedText>
                <ThemedText style={styles.autoAssignText}>
                  Assegnate automaticamente {autoAssignedCount} categorie
                </ThemedText>
          </View>
            </Card>
          </Animated.View>
        )}

        {/* Main Summary Card - Swipeable Design */}
        <Animated.View 
          style={[
            styles.summaryCardContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim1 }]
            }
          ]}
        >
          <PanGestureHandler
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanHandlerStateChange}
            activeOffsetX={[-10, 10]}
          >
            <Animated.View
              style={[
                styles.summaryCardWrapper,
                {
                  transform: [
                    { translateX: monthSlideAnim },
                    { scale: monthFadeAnim }
                  ],
                  opacity: monthFadeAnim
                }
              ]}
            >
              <Pressable
                onPressIn={() => Animated.spring(scaleAnim1, { toValue: 0.99, useNativeDriver: true }).start()}
                onPressOut={() => Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()}
              >
                <Card variant="elevated" style={styles.summaryCard}>
                  {/* Minimal Background */}
                  <View style={styles.summaryBackground} />
                  
                  {/* Navigation Indicators */}
                  <View style={styles.summaryNavigation}>
                    <Pressable 
                      style={styles.summaryNavButton}
                      onPress={() => navigateToMonth('prev')}
                      disabled={isTransitioning}
                    >
                      <ThemedText style={styles.summaryNavIcon}>‹</ThemedText>
                    </Pressable>
                    
                    <Pressable 
                      style={({ pressed }) => [
                        styles.summaryMonthIndicator,
                        {
                          backgroundColor: pressed
                            ? 'rgba(6,182,212,0.10)'
                            : 'rgba(20,184,166,0.06)',
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: 'rgba(6,182,212,0.12)',
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          // subtle shadow for more clickable feel
                          shadowColor: '#0ea5e9',
                          shadowOpacity: 0.09,
                          shadowOffset: { width: 0, height: 1 },
                          shadowRadius: 5,
                        }
                      ]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <View style={styles.monthTextContainer}>
                        <ThemedText style={styles.summaryMonthText}>
                          {monthName}
                </ThemedText>
                </View>
                    </Pressable>
                    
                    <Pressable 
                      style={[
                        styles.summaryNavButton,
                        selectedMonthOffset >= 0 && styles.summaryNavButtonDisabled
                      ]}
                      onPress={() => navigateToMonth('next')}
                      disabled={isTransitioning || selectedMonthOffset >= 0}
                    >
                      <ThemedText style={[
                        styles.summaryNavIcon,
                        selectedMonthOffset >= 0 && styles.summaryNavIconDisabled
                      ]}>›</ThemedText>
                    </Pressable>
              </View>
            
                  {/* Header Section */}
                  <View style={styles.summaryHeader}>
                    <View style={styles.summaryHeaderLeft}>
                      <View style={styles.summaryIconContainer}>
                        <View style={styles.summaryIcon}>
                          <ThemedText style={styles.summaryIconText}>💳</ThemedText>
                        </View>
                        {/* Subtle accent line */}
                        <View style={styles.summaryAccentLine} />
                      </View>
                      <View style={styles.summaryHeaderText}>
                        <ThemedText style={styles.summaryTitle}>{t('monthly_expenses')}</ThemedText>
                        <ThemedText style={styles.summarySubtitle}>{monthName}</ThemedText>
                      </View>
              </View>
            </View>
            
                  {/* Main Content */}
                  <View style={styles.summaryContent}>
                    {/* Total Amount */}
                    <View style={styles.summaryAmountContainer}>
                      <ThemedText style={[
                        styles.summaryAmount,
                        monthTotal > 0 ? { color: '#ef4444' } : { color: '#22c55e' }
                      ]}>
                        {hideBalances ? '••••• €' : Math.abs(monthTotal).toLocaleString(locale, { style: 'currency', currency })}
                        {typeof monthlyBudget === 'number' && monthlyBudget > 0 && (
                          <ThemedText style={{ fontSize: 12, color: Brand.colors.text.tertiary }}> / {monthlyBudget.toLocaleString(locale, { style: 'currency', currency })}</ThemedText>
                        )}
                      </ThemedText>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.summaryStats}>
                      <View style={styles.summaryStatItem}>
                        <View style={[styles.summaryStatBadge, { 
                borderColor: delta >= 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
              }]}>
                          <ThemedText style={[styles.summaryStatIcon, { color: delta >= 0 ? '#ef4444' : '#10b981' }]}>
                            {delta >= 0 ? '↗' : '↘'}
                          </ThemedText>
                          <ThemedText style={[styles.summaryStatValue, { color: delta >= 0 ? '#ef4444' : '#10b981' }]}>
                            {delta >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
                </ThemedText>
              </View>
                        <ThemedText style={styles.summaryStatLabel}>{t('vs_last_month')}</ThemedText>
                      </View>

                      <View style={styles.summaryStatItem}>
                        <View style={styles.summaryStatBadge}>
                          <ThemedText style={styles.summaryStatIcon}>📊</ThemedText>
                          <ThemedText style={styles.summaryStatValue}>
                            {items.filter((e) => sameMonth(e.date, curYear, curMonth)).length}
              </ThemedText>
            </View>
                        <ThemedText style={styles.summaryStatLabel}>{language === 'it' ? 'transazioni' : 'transactions'}</ThemedText>
                      </View>
                    </View>

                {/* Activity Indicator */}
                <View style={styles.summaryActivity}>
                  <View style={styles.summaryActivityBar}>
                    <Animated.View style={[styles.summaryActivityFill, { 
                      width: `${calculateActivityPercentage(monthTotal, expenseThresholds)}%`,
                      backgroundColor: getExpenseLevelColor(getExpenseLevel(monthTotal, expenseThresholds)),
                      opacity: isTransitioning ? 0.6 : 1,
                    }]} />
              </View>
                  <ThemedText style={[
                    styles.summaryActivityText,
                    isTransitioning && styles.summaryActivityTextTransitioning
                  ]}>
                    {isTransitioning ? 'Aggiornamento...' : 
                     getExpenseLevelText(getExpenseLevel(monthTotal, expenseThresholds))}
              </ThemedText>
                </View>
                  </View>
            </Card>
              </Pressable>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>


        {/* Spending Categories */}
        <Animated.View 
          style={[
            styles.categoriesSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>{language === 'it' ? 'Categorie di spesa' : 'Spending categories'}</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>{language === 'it' ? 'Distribuzione mensile' : 'Monthly distribution'}</ThemedText>
              </View>

          <View style={styles.categoriesGrid}>
            {categoryTotals.slice(0, 6).map((category, index) => (
              <Animated.View
                key={category.name}
                style={[
                  styles.categoryCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ 
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 30],
                        outputRange: [0, 30 + (index * 10)]
                      })
                    }]
                  }
                ]}
              >
                <Pressable
                  style={styles.categoryPressable}
                  onPressIn={() => {
                    setScalingCategory(category.name)
                    Animated.spring(categoryScaleAnim, { toValue: 0.95, useNativeDriver: true }).start()
                    // Smooth pulse for this specific card (uniform intensity)
                    pulseCategoryCard(category.name)
                  }}
                  onPressOut={() => {
                    setScalingCategory(null)
                    Animated.spring(categoryScaleAnim, { toValue: 1, useNativeDriver: true }).start()
                    // Stop the pulse animation when releasing
                    setPulsingCategory(null)
                    categoryPulseAnim.setValue(1)
                  }}
                  onPress={() => {
                    openCategoryHistory(category.name)
                  }}
                >
                  <Animated.View
                    style={[
                      scalingCategory === category.name && {
                        transform: [{ scale: categoryScaleAnim }]
                      }
                    ]}
                  >
                    <Animated.View
                      style={[
                        pulsingCategory === category.name && {
                          transform: [{ scale: categoryPulseAnim }]
                        }
                      ]}
                    >
                      <LinearGradient
                        colors={['rgba(139, 69, 19, 0.08)', 'rgba(139, 69, 19, 0.04)']}
                        style={styles.categoryGradient}
                      >
                      <View style={[styles.categoryIcon, { backgroundColor: 'rgba(139, 69, 19, 0.10)' }]}>
                        <ThemedText style={styles.categoryIconText}>{category.icon}</ThemedText>
                      </View>
                    <ThemedText style={styles.categoryName}>{translateCategory(category.name)}</ThemedText>
                      <ThemedText style={[
                        styles.categoryAmount,
                        // Positive totals are outgoing costs → red; zero/negative → green
                        category.amount > 0 ? { color: '#ef4444' } : { color: '#22c55e' }
                      ]}>
                        € {category.amount.toFixed(0)}
                </ThemedText>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: 'rgba(139, 69, 19, 0.10)' }]}>
                          <Animated.View 
                            style={[
                              styles.progressFill, 
                              { 
                                backgroundColor: '#8b4513',
                                width: `${category.percentage}%`
                              }
                            ]} 
                          />
            </View>
                        <ThemedText style={styles.progressText}>
                          {category.percentage.toFixed(0)}%
                        </ThemedText>
                      </View>
                      </LinearGradient>
                    </Animated.View>
                  </Animated.View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Chart Section */}
        <Animated.View 
          style={[
            styles.chartSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Card variant="default" style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View style={styles.chartIcon}>
                <ThemedText style={styles.chartIconText}>📊</ThemedText>
              </View>
              <ThemedText style={styles.chartTitle}>{language === 'it' ? 'Distribuzione per categoria' : 'Category distribution'}</ThemedText>
            </View>
            <View style={styles.chartContainer}>
              <ExpensesPie 
                key={`${curYear}-${curMonth}-${categoryUpdateTrigger}`}
                items={allMonthItems} 
                selectedYear={curYear} 
                selectedMonth={curMonth} 
              />
            </View>
          </Card>
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View 
          style={[
            styles.transactionsSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={styles.sectionTitle}>
                {isTransitioning ? t('loading') : t('recent_transactions')}
              </ThemedText>
              <Pressable 
                style={styles.refreshButton}
                onPress={fetchExpenses}
                disabled={refreshing || isTransitioning}
              >
                <ThemedText style={[
                  styles.refreshButtonText,
                  (refreshing || isTransitioning) && styles.refreshButtonTextDisabled
                ]}>
                  {refreshing || isTransitioning ? '🔄' : '↻'}
                </ThemedText>
              </Pressable>
          </View>
            <ThemedText style={styles.sectionSubtitle}>
              {selectedMonthItems.length} {selectedMonthItems.length !== 1 ? t('transactions') : t('transaction')} • {language === 'it' ? 'Ultimo aggiornamento' : 'Last update'}: {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
          
          {selectedMonthItems.length > 0 ? (
            <View style={styles.transactionsList}>
              {selectedMonthItems.slice(0, visibleTransactionsCount).map((item, index) => (
                <Animated.View
                  key={item.id ?? index}
                  style={[
                    styles.transactionItem,
                    {
                      opacity: fadeAnim,
                      transform: [{ 
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 30],
                          outputRange: [0, 30 + (index * 5)]
                        })
                      }]
                    }
                  ]}
                >
                  <Pressable
                    style={styles.transactionPressable}
                    onPress={() => handleTransactionPress(item)}
                    onPressIn={() => {
                      Animated.spring(scaleAnim1, { toValue: 0.98, useNativeDriver: true }).start()
                    }}
                    onPressOut={() => {
                      Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()
                    }}
                  >
                    <Card variant="subtle" style={styles.transactionCard}>
                      <View style={styles.transactionContent}>
                        <View style={styles.transactionLeft}>
                          <View style={styles.transactionIcon}>
                            <ThemedText style={styles.transactionIconText}>
                              {item.raw_notification === 'manual' ? '✍️' : '💳'}
            </ThemedText>
                          </View>
                          <View style={styles.transactionText}>
                            <View style={styles.transactionTitleRow}>
                              <ThemedText style={styles.transactionMerchant}>
                                {item.merchant ?? '—'}
            </ThemedText>
                            </View>
                            <View style={styles.transactionDateRow}>
                              <ThemedText style={styles.transactionDate}>
                                {formatDateWithLocale(item.date, language, locale)}
                              </ThemedText>
                              {(() => {
                                const categoryInfo = getCategoryInfo(item.merchant)
                                const isAutoAssigned = !item.category && categoryInfo?.name === 'Other'
                                const isDefaultOther = !item.category && !getMerchantCategory(item.merchant)
                                
                                // Debug for specific merchant
                                if (item.merchant === 'CAFE DES CHINEU') {
                                  console.log('CAFE DES CHINEU debug:', {
                                    merchant: item.merchant,
                                    category: item.category,
                                    categoryInfo,
                                    isAutoAssigned,
                                    isDefaultOther,
                                    getMerchantCategory: getMerchantCategory(item.merchant)
                                  })
                                }
                                
                                // Show badge if categoryInfo exists
                                return categoryInfo ? (
                                  <View style={[
                                    styles.categoryBadge, 
                                    { 
                                      backgroundColor: `${categoryInfo.color}20`,
                                      borderColor: isAutoAssigned || isDefaultOther ? `${categoryInfo.color}40` : 'transparent',
                                      borderWidth: isAutoAssigned || isDefaultOther ? 1 : 0,
                                    }
                                  ]}>
                                    <ThemedText style={[styles.categoryBadgeText, { color: categoryInfo.color }]} numberOfLines={1} ellipsizeMode="tail">
                                      {categoryInfo.icon} {shortenCategory(categoryInfo.name)}
                                      {(isAutoAssigned || isDefaultOther) && ' ✨'}
                                    </ThemedText>
                                  </View>
                                ) : (
                                  // Fallback badge for Other if no categoryInfo found
                                  <View style={[
                                    styles.categoryBadge, 
                                    { 
                                      backgroundColor: '#10b98120',
                                      borderColor: '#10b98140',
                                      borderWidth: 1,
                                    }
                                  ]}>
                                    <ThemedText style={[styles.categoryBadgeText, { color: '#10b981' }]}>
                                      📦 Other ✨
                                    </ThemedText>
                                  </View>
                                )
                              })()}
                            </View>
                          </View>
                        </View>
                        <View style={styles.transactionRight}>
                          <ThemedText style={[styles.transactionAmount, item.amount > 0 ? { color: '#ef4444' } : { color: '#22c55e' }]}>
              {Math.abs(item.amount ?? 0).toLocaleString(locale, { style: 'currency', currency })}
            </ThemedText>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteTransaction(item)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <ThemedText style={styles.deleteButtonText}>🗑️</ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                </Animated.View>
              ))}
              
              {/* Expand/Collapse Button */}
                  {selectedMonthItems.length > visibleTransactionsCount && (
                <Pressable
                  style={styles.expandButton}
                  onPress={() => {
                    const newCount = Math.min(visibleTransactionsCount + 10, selectedMonthItems.length)
                    setVisibleTransactionsCount(newCount)
                  }}
                >
                      <ThemedText style={styles.expandButtonText}>
                        {language === 'it' ? 'Mostra altre' : 'Show more'} {Math.min(10, selectedMonthItems.length - visibleTransactionsCount)} {t('transaction')}{Math.min(10, selectedMonthItems.length - visibleTransactionsCount) !== 1 ? 'i' : ''}
                      </ThemedText>
                </Pressable>
              )}
              
                  {visibleTransactionsCount > 10 && (
                <Pressable
                  style={styles.collapseButton}
                  onPress={() => setVisibleTransactionsCount(10)}
                >
                      <ThemedText style={styles.collapseButtonText}>
                        {language === 'it' ? 'Mostra meno' : 'Show less'}
                      </ThemedText>
                </Pressable>
              )}
            </View>
          ) : (
        <Card variant="subtle" style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>{t('no_expenses')}</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            {t('wallet_auto')}
          </ThemedText>
        </Card>
          )}
        </Animated.View>
      </ScrollView>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
            <Card  style={styles.modalCard}>
              <LinearGradient
                colors={['rgba(6, 181, 212, 0)', 'rgba(4, 32, 29, 0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Seleziona Categoria</ThemedText>
                <Pressable onPress={closeCategoryModal} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </Pressable>
              </View>
              
              <View style={styles.transactionInfo}>
                <ThemedText style={styles.transactionInfoMerchant}>
                  {selectedTransaction?.merchant ?? '—'}
                </ThemedText>
                <View style={styles.transactionAmountRow}>
                  <ThemedText style={[styles.transactionInfoAmount, (selectedTransaction?.amount ?? 0) > 0 ? { color: '#ef4444' } : { color: '#22c55e' }]}>
                    {Math.abs(selectedTransaction?.amount ?? 0).toLocaleString(locale, { style: 'currency', currency })}
                  </ThemedText>
                  {(selectedTransaction as any)?.is_recurring && (
                    <Pressable 
                      onPress={() => handleStopRecurring(selectedTransaction!)} 
                      style={styles.stopRecurringButton}
                    >
                      <ThemedText style={styles.stopRecurringButtonText}>
                        {language === 'it' ? 'Ferma Ricorrenza' : 'Stop Recurring'}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
                <ThemedText style={styles.transactionInfoNote}>
                  La categoria verrà applicata a {items.filter(item => item.merchant === selectedTransaction?.merchant).length} transazioni di questo merchant
                </ThemedText>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.categoriesGrid}>
                  {availableCategories.map((category, index) => (
                    <Animated.View
                      key={category.name}
                      style={[
                        styles.categoryOption,
                        {
                          opacity: fadeAnim,
                          transform: [{ 
                            translateY: slideAnim.interpolate({
                              inputRange: [0, 30],
                              outputRange: [0, 30 + (index * 5)]
                            })
                          }]
                        }
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.categoryOptionButton,
                          { borderColor: category.color }
                        ]}
                        onPress={() => handleCategorySelect(category.name)}
                      >
                        <LinearGradient
                          colors={[`${category.color}15`, `${category.color}08`]}
                          style={styles.categoryOptionGradient}
                        >
                          <View style={[styles.categoryOptionIcon, { backgroundColor: `${category.color}20` }]}>
                            <ThemedText style={styles.categoryOptionIconText}>{category.icon}</ThemedText>
                          </View>
                          <ThemedText style={styles.categoryOptionName}>{translateCategory(category.name)}</ThemedText>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              </ScrollView>
            </Card>
          </Animated.View>
        </View>
      </Modal>

      {/* Category History Modal */}
      <Modal
        visible={showCategoryHistoryModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}> 
            <Card style={styles.modalCard}>
              <LinearGradient
                colors={['rgba(6, 181, 212, 0)', 'rgba(4, 32, 29, 0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  {language === 'it' ? 'Storico categoria' : 'Category history'}{selectedHistoryCategory ? `: ${translateCategory(selectedHistoryCategory)}` : ''}
                </ThemedText>
                <Pressable onPress={() => setShowCategoryHistoryModal(false)} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </Pressable>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {categoryHistoryLoading ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <ActivityIndicator color="#06b6d4" />
                  </View>
                ) : categoryHistory.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <ThemedText style={{ color: Brand.colors.text.secondary }}>
                      {language === 'it' ? 'Nessuna transazione trovata' : 'No transactions found'}
                    </ThemedText>
                  </View>
                ) : (
                  categoryHistory.map(tx => (
                    <View key={tx.id} style={[styles.listItemCard, { marginBottom: 10 }]}> 
                      <View style={styles.listItemRow}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.listItemMerchant}>{tx.merchant || '—'}</ThemedText>
                          <ThemedText style={styles.listItemDate}>
                            {new Date(tx.date).toLocaleDateString(locale)}
                          </ThemedText>
                        </View>
                        <ThemedText style={[styles.listItemAmount, { color: tx.amount > 0 ? '#ef4444' : '#22c55e' }]}> 
                          {Math.abs(tx.amount).toLocaleString(locale, { style: 'currency', currency })}
                        </ThemedText>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </Card>
          </Animated.View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}> 
            <Card style={styles.modalCard}>
              <LinearGradient
                colors={['rgba(6, 181, 212, 0)', 'rgba(4, 32, 29, 0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>{t('delete_transaction')}</ThemedText>
              </View>
              <View style={{ alignItems: 'center', padding: 16 }}>
                <ThemedText style={styles.modalMessage}>{t('delete_confirm_text')}</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                <Pressable onPress={() => { setShowConfirmModal(false); setTransactionToDelete(null) }} style={[styles.modalButton, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }] }>
                  <ThemedText style={styles.modalButtonText}>{t('cancel')}</ThemedText>
                </Pressable>
                <Pressable onPress={async () => {
                  if (!transactionToDelete?.id) return
                  try {
                    const { error } = await deleteExpense(transactionToDelete.id!)
                    if (error) throw error
                    
                    // Update items list
                    setItems(prev => prev.filter(i => i.id !== transactionToDelete.id))
                    
                    // Update month dataset for pie chart
                    setAllMonthItems(prev => prev.filter(i => i.id !== transactionToDelete.id))
                    
                    // Force pie chart update
                    setCategoryUpdateTrigger(prev => prev + 1)
                    
                    setShowConfirmModal(false)
                    setTransactionToDelete(null)
                    
                    console.log('[Expenses] ✅ Transaction deleted, pie chart updated')
                  } catch (e) {
                    Alert.alert('Errore', 'Impossibile eliminare la transazione. Riprova.')
                  }
                }} style={[styles.modalButton, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <ThemedText style={[styles.modalButtonText, { color: '#ef4444' }]}>{t('delete')}</ThemedText>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedMonthOffset={selectedMonthOffset}
        onMonthSelect={handleDatePickerSelect}
      />
    </View>
  )
}

function formatDateWithLocale(dateStr: string, language: 'it' | 'en', locale: string) {
  if (!dateStr) return '—'
  try {
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
    
    const now = new Date()
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    if (isToday) return language === 'it' ? 'Oggi' : 'Today'
    const diffTime = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffTime / (1000 * 60))
    
    // Show relative time for recent transactions
    if (diffMinutes < 60) {
      return language === 'it'
        ? (diffMinutes < 1 ? 'Ora' : `${diffMinutes}m fa`)
        : (diffMinutes < 1 ? 'Now' : `${diffMinutes}m ago`)
    } else if (diffHours < 24) {
      return language === 'it' ? `${diffHours}h fa` : `${diffHours}h ago`
    } else if (diffDays === 1) {
      return language === 'it' ? 'Ieri' : 'Yesterday'
    } else if (diffDays < 7) {
      return language === 'it' ? `${diffDays} giorni fa` : `${diffDays} days ago`
    } else {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    }
  } catch {
    return dateStr
  }
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
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: Brand.colors.text.primary,
    marginBottom: Brand.spacing['3xl'],
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoAssignNotification: {
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  autoAssignCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  autoAssignContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoAssignIcon: {
    fontSize: 20,
  },
  autoAssignText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    flex: 1,
  },
  hideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideButtonText: {
    fontSize: 20,
  },
  balanceCardContainer: {
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  balanceCard: {
    padding: 24,
    minHeight: 180,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  balanceIconContainer: {
    position: 'relative',
    marginBottom: 20,
    zIndex: 1,
  },
  balanceIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neonLine: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  balanceIconText: {
    fontSize: 36,
  },
  balanceContent: {
    flex: 1,
    zIndex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Brand.colors.text.secondary,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 20,
    padding: 2,
    color: '#ef4444',
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  balanceBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  balanceSubtext: {
    fontSize: 13,
    opacity: 0.6,
    flex: 1,
    color: Brand.colors.text.tertiary,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: Brand.colors.glow.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  kpiGradient: {
    padding: 20,
    alignItems: 'center',
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiIconText: {
    fontSize: 24,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.colors.text.primary,
  },
  categoriesSection: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.colors.text.primary,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButtonTextDisabled: {
    opacity: 0.6,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    marginBottom: 12,
  },
  categoryPressable: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  categoryGradient: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryIconText: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 8,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    marginBottom: 12,
  },
  progressContainer: {
    gap: 6,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.colors.text.tertiary,
    textAlign: 'right',
  },
  emptyCategoriesContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyCategoriesText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyCategoriesSubtext: {
    fontSize: 14,
    color: Brand.colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  chartSection: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  chartCard: {
    padding: 24,
    borderRadius: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  chartIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartIconText: {
    fontSize: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  chartContainer: {
    height: 280,
  },
  transactionsSection: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    marginBottom: 8,
  },
  transactionPressable: {
    borderRadius: 16,
  },
  transactionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    marginBottom: 1,
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  transactionIconText: {
    fontSize: 18,
  },
  transactionText: {
    flex: 1,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  transactionDate: {
    fontSize: 14,
    color: '#06b6d4',
    fontWeight: '600',
  },
  transactionRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 16,
  },
  transactionAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#06b6d4',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    textAlign: 'center',
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 16,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgb(5, 5, 5)',
    opacity: 0.95,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalCard: {
    padding: 24,
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  modalMessage: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  modalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  transactionInfo: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
    zIndex: 1,
  },
  transactionInfoMerchant: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 4,
  },
  transactionAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  transactionInfoAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#06b6d4',
  },
  stopRecurringButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stopRecurringButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff3b30',
  },
  transactionInfoNote: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  transactionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryOption: {
    width: '47%',
    marginBottom: 12,
    zIndex: 1,
  },
  
  // Swipeable Summary Card Styles
  summaryCardContainer: {
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  summaryCardWrapper: {
    position: 'relative',
  },
  summaryCard: {
    borderRadius: 20,
    padding: 24,
    minHeight: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  summaryNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  summaryNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryNavButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  summaryNavIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  summaryNavIconDisabled: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  summaryMonthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  monthTextContainer: {
    alignItems: 'center',
  },
  summaryMonthText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  summaryMonthOffset: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(6, 182, 212, 0.8)',
  },
  datePickerIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerIconText: {
    fontSize: 10,
  },
  datePickerIconInline: {
    fontSize: 15,
    marginLeft: 8,
    opacity: 0.6,
  },
  summaryBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 15, 20, 0.6)',
    borderRadius: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryIconText: {
    fontSize: 20,
  },
  summaryAccentLine: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(6, 182, 212, 0.4)',
    borderRadius: 1,
  },
  summaryHeaderText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  summarySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
    textTransform: 'capitalize',
  },
  summaryHeaderRight: {
    alignItems: 'center',
  },
  summaryHideButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryHideIcon: {
    fontSize: 14,
  },
  summaryContent: {
    flex: 1,
  },
  summaryAmountContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    letterSpacing: -1,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  summaryStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  summaryStatIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  summaryStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
    textAlign: 'center',
  },
  summaryActivity: {
    alignItems: 'center',
  },
  summaryActivityBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  summaryActivityFill: {
    height: '100%',
    borderRadius: 2,
  },
  summaryActivityText: {
    fontSize: 11,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
    textAlign: 'center',
  },
  summaryActivityTextTransitioning: {
    color: 'rgba(6, 182, 212, 0.8)',
    fontWeight: '600',
  },
  // Simple list item styles reused in category history modal
  listItemCard: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  listItemDate: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
    marginTop: 2,
  },
  listItemAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryOptionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  categoryOptionGradient: {
    padding: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  categoryOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryOptionIconText: {
    fontSize: 18,
  },
  categoryOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    textAlign: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  deleteButtonText: {
    fontSize: 14,
  },
  expandButton: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButtonGradient: {
    // Remove gradient, use solid background instead
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  collapseButton: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
  },
})

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


