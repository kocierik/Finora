import { ExpensesPie } from '@/components/charts/ExpensesPie'
import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { DatePickerModal } from '@/components/ui/DatePickerModal'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { DEFAULT_CATEGORIES } from '@/constants/categories'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import { sendWeeklyBulkCategoryReminder } from '@/services/category-reminder'
import { syncPendingExpenses } from '@/services/expense-sync'
import { calculateActivityPercentage, getExpenseLevel, getExpenseLevelColor, getExpenseLevelText, loadExpenseThresholds, type ExpenseThresholds } from '@/services/expense-thresholds'
import { deleteExpense } from '@/services/expenses'
import { Expense } from '@/types'
import { useFocusEffect } from '@react-navigation/native'
import { cacheDirectory, readAsStringAsync } from 'expo-file-system/legacy'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, DeviceEventEmitter, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'

export default function ExpensesScreen() {
  const { locale, currency, t, monthlyBudget, language, categories: configuredCategories } = useSettings()
  const { user, loading } = useAuth()
  
  // Debug flag to reduce excessive logging
  const DEBUG_MODE = __DEV__ && false // Set to true for detailed debugging
  const [items, setItems] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<any[]>([])
  const [hideBalances, setHideBalances] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Expense | any | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Expense | null>(null)
  const [incomeToDelete, setIncomeToDelete] = useState<any | null>(null)
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
  // Categories loaded from DB (categories table)
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; icon: string; color: string; sort_order: number }[]>([])
  // Pending expenses state
  const [pendingExpensesCount, setPendingExpensesCount] = useState(0)
  
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


  // Load categories from DB categories table
  const loadCategoriesFromDb = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
      if (error) throw error
      
      // If no categories exist, create default ones
      if (!data || data.length === 0) {
        const { data: newCategories, error: createError } = await supabase
          .from('categories')
          .insert(DEFAULT_CATEGORIES.map((cat, index) => ({
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            sort_order: index,
            user_id: user.id
          })))
          .select()
        
        if (createError) {
          console.error('Error creating default categories:', createError)
          return
        }
        
        const normalized = (newCategories || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          sort_order: c.sort_order,
        }))
        setDbCategories(normalized)
      } else {
        const normalized = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          sort_order: c.sort_order,
        }))
        setDbCategories(normalized)
      }
      
      // Trigger UI that depends on categories
      setCategoryUpdateTrigger((prev) => prev + 1)
    } catch (e) {
    }
  }, [user?.id])

  // Funzione per controllare le spese pendenti
  const checkPendingExpenses = useCallback(async () => {
    try {
      const expensesFile = `${cacheDirectory}pending_expenses.json`
      const data = await readAsStringAsync(expensesFile)
      const pendingExpenses = JSON.parse(data)
      const unsyncedCount = pendingExpenses.filter((e: any) => !e.synced).length
      setPendingExpensesCount(unsyncedCount)
      
      // Invia notifica di promemoria settimanale se ci sono spese pendenti
      if (unsyncedCount > 0) {
        try {
          await sendWeeklyBulkCategoryReminder(unsyncedCount)
        } catch (error) {
          console.warn('[ExpensesScreen] Failed to send weekly bulk category reminder:', error)
        }
      }
    } catch (error) {
      setPendingExpensesCount(0)
    }
  }, [])

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    try {
      // Sincronizza le spese pendenti dalle notifiche Google Wallet
      const syncResult = await syncPendingExpenses(user.id)
      if (syncResult.synced > 0) {
        // Trigger category cards update
        setCategoryUpdateTrigger(prev => prev + 1)
      }
      
      const [{ data: expensesData }, { data: incomesData }] = await Promise.all([
        supabase
          .from('expenses')
          .select(`
            *,
            categories (
              id,
              name,
              icon,
              color
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('incomes')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ])
      
      const sortedItems = (expensesData as Expense[])?.sort((a, b) => {
        // Sort by date descending, then by created_at descending
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        if (dateA.getTime() === dateB.getTime()) {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        }
        return dateB.getTime() - dateA.getTime()
      }) ?? []
      
      setIncomes(incomesData || [])
      
      // Debug: Log sample transactions to see their category structure
      
      
      // Auto-assign categories for new transactions
      const updatedItems = await autoAssignCategories(sortedItems)
      
      // Debug log (simplified)
      if (DEBUG_MODE) {
      }
      
      setItems(updatedItems)
      
      // Trigger category update
      setCategoryUpdateTrigger(prev => prev + 1)
      
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
      
      
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          categories (
            id,
            name,
            icon,
            color
          )
        `)
        .eq('user_id', user.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false })
      
      if (error) throw error
      
      setAllMonthItems(data || [])
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
      fetchExpenses()
      loadAllMonthItems(curYear, curMonth)
      // Force pie chart update
      setCategoryUpdateTrigger(prev => prev + 1)
      // Force categories reload
      loadCategoriesFromDb()
    })

    const subSettings = DeviceEventEmitter.addListener('settings:categoriesUpdated', () => {
      loadCategoriesFromDb()
      fetchExpenses()
      setCategoryUpdateTrigger(prev => prev + 1)
    })

    return () => { clearInterval(interval); sub.remove(); subSettings.remove() }
  }, [fetchExpenses])

  // Initial load and refresh on focus/events
  useEffect(() => {
    loadCategoriesFromDb()
    checkPendingExpenses()
    
    const sub1 = DeviceEventEmitter.addListener('settings:categoriesUpdated', () => {
      loadCategoriesFromDb()
    })
    
    const sub2 = DeviceEventEmitter.addListener('expenses:duplicatesRemoved', (data) => {
      // Ricarica le spese e le categorie quando vengono rimossi dei duplicati
      fetchExpenses()
      loadCategoriesFromDb()
    })
    
    return () => { 
      sub1.remove()
      sub2.remove()
    }
  }, [loadCategoriesFromDb, checkPendingExpenses, fetchExpenses])

  // KPIs
  // Month calculations with navigation support
  const now = new Date()
  const currentDate = new Date(now.getFullYear(), now.getMonth() + selectedMonthOffset, 1)
  const curMonth = currentDate.getMonth()
  const curYear = currentDate.getFullYear()
  const prevMonthDate = new Date(curYear, curMonth - 1, 1)
  const prevMonth = prevMonthDate.getMonth()
  const prevYear = prevMonthDate.getFullYear()

  // Focus effect to reload data when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchExpenses()
      loadExpenseThresholdsData()
      loadAllMonthItems(curYear, curMonth)
      // Force pie chart update when tab comes into focus
      setCategoryUpdateTrigger(prev => prev + 1)
    }, [fetchExpenses, loadExpenseThresholdsData, loadAllMonthItems, curYear, curMonth])
  )
  // Calculate month expenses and income separately
  const selectedMonthItems = items.filter((e) => sameMonth(e.date, curYear, curMonth))
  const monthExpenses = selectedMonthItems.reduce((sum, e) => {
    // Considera solo le spese (negative amounts)
    let expenseAmount = e.amount
    
    // Se amount è già negativo, è sicuramente una spesa (nuovo formato)
    if (expenseAmount < 0) {
      return sum + Math.abs(expenseAmount)
    }
    
    // Se amount è positivo, verifica se è una spesa o un'entrata
    if (expenseAmount > 0) {
      const notificationText = (e.raw_notification || '').toLowerCase()
      const merchantText = (e.merchant || '').toLowerCase()
      const isManual = notificationText === 'manual' || notificationText === ''
      const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
      
      // Se è manuale o non ha parole chiave di accredito, è una spesa → converti in negativo e aggiungi
      if (isManual || !hasIncomeKeywords) {
        return sum + Math.abs(expenseAmount)
      }
      // Altrimenti è un'entrata → non contarla nelle spese
    }
    
    return sum
  }, 0)
  
  const monthIncome = selectedMonthItems.reduce((sum, e) => {
    // Considera solo le entrate (positive amounts con parole chiave accredito)
    let incomeAmount = e.amount
    if (incomeAmount > 0) {
      const notificationText = (e.raw_notification || '').toLowerCase()
      const isManual = notificationText === 'manual' || notificationText === ''
      const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText)
      if (!isManual && hasIncomeKeywords) {
        return sum + incomeAmount
      }
    }
    return sum
  }, 0)
  
  // Month total = income - expenses (positive = profit, negative = loss)
  const monthTotal = monthIncome - monthExpenses
  
  // Previous month totals for comparison
  const prevMonthItems = items.filter((e) => sameMonth(e.date, prevYear, prevMonth))
  const prevMonthExpenses = prevMonthItems.reduce((sum, e) => {
    let expenseAmount = e.amount
    
    // Se amount è già negativo, è sicuramente una spesa (nuovo formato)
    if (expenseAmount < 0) {
      return sum + Math.abs(expenseAmount)
    }
    
    // Se amount è positivo, verifica se è una spesa o un'entrata
    if (expenseAmount > 0) {
      const notificationText = (e.raw_notification || '').toLowerCase()
      const merchantText = (e.merchant || '').toLowerCase()
      const isManual = notificationText === 'manual' || notificationText === ''
      const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
      
      // Se è manuale o non ha parole chiave di accredito, è una spesa → aggiungi
      if (isManual || !hasIncomeKeywords) {
        return sum + Math.abs(expenseAmount)
      }
      // Altrimenti è un'entrata → non contarla nelle spese
    }
    
    return sum
  }, 0)
  const prevTotal = prevMonthExpenses
  const delta = monthExpenses - prevTotal // Delta spese (quanto sono aumentate/diminuite)
  const deltaPct = prevTotal > 0 ? (delta / prevTotal) * 100 : 0

  const monthName = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  // Load all month items when month changes
  useEffect(() => {
    loadAllMonthItems(curYear, curMonth)
    // Reset visible transactions count when month changes
    setVisibleTransactionsCount(10)
  }, [curYear, curMonth, loadAllMonthItems])

  // Filter incomes for selected month (selectedMonthItems already defined above)
  const selectedMonthIncomes = incomes.filter((i) => sameMonth(i.date, curYear, curMonth))

  // Calculate month income total
  const monthIncomeTotal = selectedMonthIncomes.reduce((sum, income) => sum + (income.amount || 0), 0)

  // Combine expenses and incomes for the selected month
  const allMonthTransactions = useMemo(() => {
    // Process expenses: amount < 0 = spesa, amount > 0 con parole chiave accredito = entrata
    const expenseTransactions = selectedMonthItems.map(expense => {
      // Se amount è già negativo, è sicuramente una spesa (nuovo formato)
      if (expense.amount < 0) {
        return {
          id: expense.id,
          type: 'expense' as const,
          amount: expense.amount, // Già negativo
          description: expense.merchant || 'Expense',
          category: expense.categories?.name || expense.category || 'Other',
          categoryIcon: expense.categories?.icon || '💳',
      categoryColor: expense.categories?.color || Brand.colors.primary.cyan,
          date: expense.date,
          created_at: expense.created_at,
          isRecurring: expense.is_recurring,
          raw_notification: expense.raw_notification,
          originalData: expense
        }
      }
      
      // Se amount è positivo, determina se è un accredito
      const notificationText = (expense.raw_notification || '').toLowerCase()
      const merchantText = (expense.merchant || '').toLowerCase()
      
      // Le transazioni manuali sono sempre spese
      const isManual = notificationText === 'manual' || notificationText === ''
      
      // Controlla parole chiave di accredito solo se non è manuale
      const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
      
      // Se amount è positivo E ha parole chiave di accredito, è un'entrata
      // Altrimenti (manual o senza parole chiave), è una spesa → converti in negativo
      const isIncome = expense.amount > 0 && hasIncomeKeywords && !isManual
      
      // Normalizza l'amount: se è una spesa ma è positivo, convertilo in negativo
      const normalizedAmount = isIncome ? expense.amount : -Math.abs(expense.amount)
      
      return {
        id: expense.id,
        type: isIncome ? 'income' as const : 'expense' as const,
        amount: normalizedAmount, // Negativo per spese, positivo per entrate
        description: expense.merchant || (isIncome ? 'Accredito' : 'Expense'),
        category: expense.categories?.name || expense.category || 'Other',
        categoryIcon: expense.categories?.icon || '💳',
    categoryColor: expense.categories?.color || Brand.colors.primary.cyan,
        date: expense.date,
        created_at: expense.created_at,
        isRecurring: expense.is_recurring,
        raw_notification: expense.raw_notification,
        // Keep original expense data for compatibility
        originalData: expense
      }
    })

    const incomeTransactions = selectedMonthIncomes.map(income => ({
      id: income.id,
      type: 'income' as const,
      amount: income.amount, // Positive for incomes
      description: income.description || income.source || 'Income',
      category: income.category || 'work',
      categoryIcon: income.source === 'salary' ? '💼' : 
                   income.source === 'freelance' ? '💻' :
                   income.source === 'investment' ? '📈' :
                   income.source === 'bonus' ? '🎁' : '💰',
      categoryColor: income.category === 'work' ? Brand.colors.semantic.success :
                    income.category === 'passive' ? Brand.colors.primary.magenta :
                    income.category === 'investment' ? Brand.colors.primary.orange : Brand.colors.semantic.info,
      date: income.date,
      created_at: income.created_at,
      isRecurring: income.is_recurring,
      raw_notification: 'manual',
      // Keep original income data for compatibility
      originalData: income
    }))

    return [...expenseTransactions, ...incomeTransactions]
      .sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        if (dateA.getTime() === dateB.getTime()) {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        }
        return dateB.getTime() - dateA.getTime()
      })
  }, [selectedMonthItems, selectedMonthIncomes])

  // Debug log for month calculation (simplified)
  if (DEBUG_MODE) {
  }

  // Prefer DB categories if available, otherwise fall back to settings
  const effectiveCategories = useMemo(() => (dbCategories?.length ? dbCategories : (configuredCategories || [])), [dbCategories, configuredCategories])

  // Income categories
  const incomeCategories = [
    { id: 'work', name: 'Work', icon: '💼', color: Brand.colors.semantic.success },
    { id: 'passive', name: 'Passive', icon: '💰', color: Brand.colors.primary.magenta },
    { id: 'investment', name: 'Investment', icon: '📈', color: Brand.colors.primary.orange },
    { id: 'other', name: 'Other', icon: '🎁', color: Brand.colors.semantic.info }
  ]

  // Get available categories based on transaction type
  const getAvailableCategories = () => {
    if (selectedTransaction?.type === 'income') {
      return incomeCategories
    }
    return effectiveCategories
  }

  // Spending categories for main grid (first 6)
  const categories = useMemo(() => {
    return (effectiveCategories || []).slice(0, 6).map(c => ({
      id: (c as any).id || `temp-${c.name}`,
      name: c.name,
      icon: c.icon,
      color: c.color,
      amount: 0,
      percentage: 0,
    }))
  }, [effectiveCategories])

  // Main categories for selection (use all effective categories)
  const mainCategories = useMemo(() => {
    return (effectiveCategories || []).map(c => {
      const category = c as any
      return {
        id: category.id || `temp-${c.name}`,
      name: c.name,
      icon: c.icon,
      color: c.color,
      amount: 0,
      percentage: 0,
      }
    })
  }, [effectiveCategories])

  // Available categories for selection (first 6 categories only)
  const availableCategories = categories

  // Shorten category label to avoid overlap in badges
  const shortenCategory = (name: string) => {
    return name.length > UI_CONSTANTS.CATEGORY_MAX_LENGTH ? name.slice(0, UI_CONSTANTS.CATEGORY_MAX_LENGTH) + '…' : name
  }

  // Calculate category spending from real data - use useMemo to make it reactive
  const categoryTotals = useMemo(() => {
    // Use allMonthItems which is already filtered for the selected month and includes category joins
    const currentMonthItems = allMonthItems
    
    // Debug: log to see what we're working with
    if (__DEV__) {
      console.log('[CategoryTotals] allMonthItems count:', currentMonthItems.length)
      console.log('[CategoryTotals] categories to match:', categories.map(c => c.name))
      if (currentMonthItems.length > 0) {
        const sampleItems = currentMonthItems.slice(0, 3).map(e => ({
          merchant: e.merchant,
          amount: e.amount,
          category: e.category,
          categoriesName: e.categories?.name
        }))
        console.log('[CategoryTotals] Sample items:', sampleItems)
      }
    }
    
    return categories.map(cat => {
      // Match by categories.name (new structure) or by category (legacy)
      const categoryItems = currentMonthItems.filter(e => {
        const categoryName = e.categories?.name || e.category || ''
        const matches = categoryName.toLowerCase() === cat.name.toLowerCase()
        
        
        return matches
      })
      
      // Sum only expenses (negative amounts), ignore income (positive amounts) for category totals
      const amount = categoryItems.reduce((sum, e) => {
        // Considera solo le spese (negative), ignora gli accrediti (positivi)
        // Se amount è positivo ma è una spesa vecchia, convertilo
        let expenseAmount = e.amount
        if (expenseAmount > 0) {
          // Check if it's actually an expense (manual transaction or no income keywords)
          const notificationText = (e.raw_notification || '').toLowerCase()
          const isManual = notificationText === 'manual' || notificationText === ''
          const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText)
          if (isManual || !hasIncomeKeywords) {
            expenseAmount = -Math.abs(expenseAmount)
          }
        }
        return sum + (expenseAmount < 0 ? expenseAmount : 0)
      }, 0)
      
      // Calcola percentuale basata solo sulle spese totali (solo negative)
      const totalExpenses = currentMonthItems.reduce((sum, e) => {
        let expenseAmount = e.amount
        if (expenseAmount > 0) {
          const notificationText = (e.raw_notification || '').toLowerCase()
          const isManual = notificationText === 'manual' || notificationText === ''
          const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText)
          if (isManual || !hasIncomeKeywords) {
            expenseAmount = -Math.abs(expenseAmount)
          }
        }
        return sum + (expenseAmount < 0 ? Math.abs(expenseAmount) : 0)
      }, 0)
      
      const percentage = totalExpenses > 0 ? (Math.abs(amount) / totalExpenses) * 100 : 0
      
      
      return { ...cat, amount, percentage }
    }).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }, [allMonthItems, curYear, curMonth, categoryUpdateTrigger, categories])

  const onRefresh = useCallback(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // Funzione per sincronizzare manualmente le spese dalle notifiche JSON
  const syncFromNotifications = useCallback(async () => {
    if (!user) return
    
    setRefreshing(true)
    
    try {
      // Sincronizza le spese pendenti dalle notifiche
      const syncResult = await syncPendingExpenses(user.id)
      
      // Ricarica le spese dopo la sincronizzazione
      await fetchExpenses()
      
      // Controlla le spese pendenti rimanenti
      await checkPendingExpenses()
      
      if (syncResult.synced > 0) {
        Alert.alert(
          'Sincronizzazione Completata', 
          `Sincronizzate ${syncResult.synced} nuove spese dalle notifiche`,
          [{ text: 'OK', style: 'default' }]
        )
      } else {
        Alert.alert(
          'Sincronizzazione', 
          'Nessuna nuova spesa da sincronizzare dalle notifiche',
          [{ text: 'OK', style: 'default' }]
        )
      }
    } catch (error) {
      console.error('[Expenses] ❌ Sync from notifications failed:', error)
      Alert.alert(
        'Errore', 
        'Errore durante la sincronizzazione dalle notifiche',
        [{ text: 'OK', style: 'default' }]
      )
    } finally {
      setRefreshing(false)
    }
  }, [user, fetchExpenses])

  const handleTransactionPress = useCallback((transaction: Expense) => {
    setSelectedTransaction({ ...transaction, type: 'expense' })
    setShowCategoryModal(true)
  }, [])

  const handleIncomePress = useCallback((income: any) => {
    setSelectedTransaction({ ...income, type: 'income' })
    setShowCategoryModal(true)
  }, [])

  const handleDeleteIncome = useCallback(async (income: any) => {
    if (!income.id) {
      console.error('Cannot delete income without ID')
      return
    }

    setShowConfirmModal(true)
    setIncomeToDelete(income)
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
  const openCategoryHistory = useCallback(async (categoryId: string) => {
    if (!user) return
    
    // Find the category details
    const category = dbCategories.find(c => c.id === categoryId)
    if (!category) {
      console.error('Category not found:', categoryId)
      return
    }
    
    setSelectedHistoryCategory(category.name)
    setShowCategoryHistoryModal(true)
    setCategoryHistory([])
    setCategoryHistoryLoading(true)
    try {
      // Limit to currently selected month
      const startDate = new Date(curYear, curMonth, 1)
      const endDate = new Date(curYear, curMonth + 1, 0)
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      // Load expenses for this category
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          categories (
            id,
            name,
            icon,
            color
          )
        `)
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false })
      
      if (expensesError) throw expensesError
      
      // Also load incomes that match this category (if category exists in incomes)
      // Note: incomes use category field as string, not category_id
      const categoryName = dbCategories.find(c => c.id === categoryId)?.name || category.name
      const { data: incomesData, error: incomesError } = await supabase
        .from('incomes')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', categoryName.toLowerCase())
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false })
      
      if (incomesError) throw incomesError
      
      // Combine expenses and incomes, and normalize to show correct type
      const combinedData = [
        ...(expensesData || []).map(exp => {
          // Determine if expense is actually an income (positive amount with income keywords)
          const notificationText = (exp.raw_notification || '').toLowerCase()
          const merchantText = (exp.merchant || '').toLowerCase()
          const isManual = notificationText === 'manual' || notificationText === ''
          const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
          const isIncome = exp.amount > 0 && hasIncomeKeywords && !isManual
          
          return {
            ...exp,
            amount: isIncome ? exp.amount : (exp.amount < 0 ? exp.amount : -Math.abs(exp.amount)),
            type: isIncome ? 'income' : 'expense'
          }
        }),
        ...(incomesData || []).map(inc => ({
          ...inc,
          amount: Math.abs(inc.amount), // Incomes are always positive
          type: 'income',
          categories: {
            name: inc.category || 'work',
            color: inc.category === 'work' ? Brand.colors.semantic.success :
                   inc.category === 'passive' ? Brand.colors.primary.magenta :
                   inc.category === 'investment' ? Brand.colors.primary.orange : Brand.colors.semantic.info,
            icon: inc.source === 'salary' ? '💼' : 
                  inc.source === 'freelance' ? '💻' :
                  inc.source === 'investment' ? '📈' :
                  inc.source === 'bonus' ? '🎁' : '💰'
          },
          merchant: inc.description || inc.source || 'Income'
        }))
      ].sort((a, b) => {
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        return dateB.getTime() - dateA.getTime()
      })
      
      setCategoryHistory(combinedData as any)
    } catch (e) {
      console.error('[Expenses] ❌ Error fetching category history', e)
    } finally {
      setCategoryHistoryLoading(false)
    }
  }, [user, curYear, curMonth, dbCategories])

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    if (!selectedTransaction || !user) return

    try {
      // Check if it's an income or expense transaction
      if (selectedTransaction.type === 'income') {
        // Handle income category update
        const { error } = await supabase
          .from('incomes')
          .update({ category: categoryId })
          .eq('user_id', user.id)
          .eq('id', selectedTransaction.id)
        if (error) throw error

        // Update local state
        setIncomes(prev => prev.map(it =>
          it.id === selectedTransaction.id ? { ...it, category: categoryId } : it
        ))
      } else {
        // Handle expense category update (existing logic)
        // Find the category details
        const category = dbCategories.find(c => c.id === categoryId)
        if (!category) {
          console.error('Category not found:', categoryId)
          return
        }

        // Update all transactions with the same merchant name
        const { error } = await supabase
          .from('expenses')
          .update({ category_id: categoryId })
          .eq('user_id', user.id)
          .eq('merchant', selectedTransaction.merchant)

        if (error) throw error

        // Update local state for all matching transactions
        const updatedItems = items.map(item => 
          item.merchant === selectedTransaction.merchant 
            ? { ...item, category_id: categoryId, categories: category }
            : item
        )
        
        setItems(updatedItems)

        // Update month dataset used by pie chart so it refreshes immediately
        setAllMonthItems(prev => prev.map(item =>
          item.merchant === selectedTransaction.merchant
            ? { ...item, category_id: categoryId, categories: category }
            : item
        ))

        // Trigger recalculation of memoized category totals
        setCategoryUpdateTrigger(prev => prev + 1)
      }

      setShowCategoryModal(false)
      setSelectedTransaction(null)
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }, [selectedTransaction, user, dbCategories, items])

  const closeCategoryModal = useCallback(() => {
    setShowCategoryModal(false)
    setSelectedTransaction(null)
  }, [])

  // Reset all expenses function
  const handleResetAllExpenses = useCallback(async () => {
    if (!user) return
    
    try {
      // Delete all expenses for the user
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('user_id', user.id)
      
      if (error) throw error
      
      // Clear local state
      setItems([])
      setAllMonthItems([])
      
      // Force pie chart update
      setCategoryUpdateTrigger(prev => prev + 1)
      
      setShowResetModal(false)
      
      Alert.alert(
        'Reset Completato',
        'Tutte le spese sono state eliminate con successo',
        [{ text: 'OK', style: 'default' }]
      )
      
    } catch (error) {
      console.error('[Expenses] ❌ Error resetting expenses:', error)
      Alert.alert(
        'Errore',
        'Impossibile eliminare le spese. Riprova.',
        [{ text: 'OK', style: 'default' }]
      )
    }
  }, [user])

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
    const transactionsToUpdate: { id: string; category_id: string }[] = []

    // Group transactions by merchant
    const merchantCategories = new Map<string, string>()
    
    // First pass: collect existing category_ids for each merchant
    for (const transaction of updatedTransactions) {
      if (transaction.category_id && transaction.merchant) {
        merchantCategories.set(transaction.merchant, transaction.category_id)
      }
    }

    // Second pass: assign categories to transactions without them
    for (let i = 0; i < updatedTransactions.length; i++) {
      const transaction = updatedTransactions[i]
      
      if (!transaction.category_id && transaction.merchant && merchantCategories.has(transaction.merchant)) {
        const categoryId = merchantCategories.get(transaction.merchant)!
        const category = dbCategories.find(c => c.id === categoryId)
        if (category) {
          updatedTransactions[i] = { ...transaction, category_id: categoryId, categories: category }
          transactionsToUpdate.push({ id: transaction.id!, category_id: categoryId })
        }
      }
    }

    // Update database for transactions that got auto-assigned categories
    if (transactionsToUpdate.length > 0) {
      try {
        for (const update of transactionsToUpdate) {
          await supabase
            .from('expenses')
            .update({ category_id: update.category_id })
            .eq('id', update.id)
        }
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
  }, [user, dbCategories])

  // Function to get category for a merchant
  const getMerchantCategory = useCallback((merchant: string) => {
    // First try to find a transaction with categories already loaded
    const transactionWithCategories = items.find(item => item.merchant === merchant && item.categories)
    if (transactionWithCategories?.categories) {
      return transactionWithCategories.categories
    }
    
    // If no categories loaded, try to find by category_id and lookup in dbCategories
    const transactionWithCategoryId = items.find(item => item.merchant === merchant && item.category_id)
    if (transactionWithCategoryId?.category_id) {
      const category = dbCategories.find(c => c.id === transactionWithCategoryId.category_id)
      if (category) {
        return category
      }
    }
    
    // Fallback to legacy category field
    const transactionWithLegacyCategory = items.find(item => item.merchant === merchant && item.category)
    if (transactionWithLegacyCategory?.category) {
      const category = dbCategories.find(c => c.name.toLowerCase() === transactionWithLegacyCategory.category?.toLowerCase())
      if (category) {
        return category
      }
    }
    
    return null
  }, [items, dbCategories])

  // Function to get category info for display
  const getCategoryInfo = useCallback((merchant: string) => {
    const category = getMerchantCategory(merchant)
    if (category) {
      return category
    }
    
    // Fallback to 'Miscellaneous' category if no category found
    const miscellaneousCategory = dbCategories.find(c => c.name.toLowerCase() === 'miscellaneous')
    return miscellaneousCategory || null
  }, [getMerchantCategory, dbCategories])

  if (loading) {
  return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Brand.colors.primary.cyan} />
      </View>
    )
  }

  // Durante il logout/redirect mostra caricamento invece di errore
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Brand.colors.primary.cyan} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[Brand.colors.background.deep, Brand.colors.background.base, Brand.colors.background.deep]}
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
                          <LinearGradient
                colors={[Brand.colors.glow.danger, UI_CONSTANTS.DANGER_BG, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.incomeGradient}
              />
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
                            ? UI_CONSTANTS.ACCENT_CYAN_BG
                            : UI_CONSTANTS.GLASS_BG_SM,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
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
                        { color: Brand.colors.semantic.danger } // Rosso per le spese totali
                      ]}>
                        {hideBalances ? '••••• €' : monthExpenses.toLocaleString(locale, { style: 'currency', currency })}
                        {typeof monthlyBudget === 'number' && monthlyBudget > 0 && (
                          <ThemedText style={{ fontSize: 12, color: Brand.colors.text.tertiary }}> / {monthlyBudget.toLocaleString(locale, { style: 'currency', currency })}</ThemedText>
                        )}
                      </ThemedText>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.summaryStats}>
                      <View style={styles.summaryStatItem}>
                        <View style={[styles.summaryStatBadge, { 
                borderColor: delta >= 0 ? UI_CONSTANTS.DANGER_BORDER : UI_CONSTANTS.SUCCESS_BORDER,
              }]}>
                          <ThemedText style={[styles.summaryStatIcon, { color: delta >= 0 ? Brand.colors.semantic.danger : Brand.colors.semantic.success }]}>
                            {delta >= 0 ? '↗' : '↘'}
                          </ThemedText>
                          <ThemedText style={[styles.summaryStatValue, { color: delta >= 0 ? Brand.colors.semantic.danger : Brand.colors.semantic.success }]}>
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


        {/* Income Section */}
          <Animated.View 
            style={[
              styles.incomeSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>{language === 'it' ? 'Guadagni del mese' : 'Monthly income'}</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>{language === 'it' ? 'Entrate registrate' : 'Recorded income'}</ThemedText>
            </View>
            
            <Card variant="default" style={styles.incomeCard}>
              <LinearGradient
                colors={[UI_CONSTANTS.GRADIENT_PROFIT_POS[0], UI_CONSTANTS.GRADIENT_PROFIT_POS[1], 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.incomeGradient}
              />
              <View style={styles.incomeContent}>
                <View style={styles.incomeIcon}>
                  <ThemedText style={styles.incomeIconText}>💰</ThemedText>
                </View>
                <View style={styles.incomeDetails}>
                  <ThemedText style={styles.incomeLabel}>
                    {language === 'it' ? 'Totale guadagni' : 'Total income'}
                  </ThemedText>
                  <ThemedText style={styles.incomeAmount}>
                    {hideBalances ? '••••• €' : monthIncomeTotal.toLocaleString(locale, { style: 'currency', currency })}
                  </ThemedText>
                  <ThemedText style={styles.incomeCount}>
                    {selectedMonthIncomes.length} {language === 'it' ? 'entrate' : 'incomes'}
                  </ThemedText>
                </View>
              </View>
            </Card>
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
                    openCategoryHistory(category.id)
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
                      <View style={[styles.categoryGradient]}>
                        <LinearGradient
                          colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.categoryGradientOverlay}
                          pointerEvents="none"
                        />
                      <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                        <ThemedText style={styles.categoryIconText}>{category.icon}</ThemedText>
                      </View>
                    <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                      <ThemedText style={[
                        styles.categoryAmount,
                        // Negative amounts are expenses (spese) → red; positive/zero → green
                        category.amount < 0 ? { color: Brand.colors.semantic.danger } : { color: Brand.colors.semantic.success }
                      ]}>
                        € {Math.abs(category.amount).toFixed(2)}
                </ThemedText>
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: `${category.color}20` }]}>
                          <Animated.View 
                            style={[
                              styles.progressFill, 
                              { 
                                backgroundColor: category.color,
                                width: `${category.percentage}%`
                              }
                            ]} 
                          />
            </View>
                        <ThemedText style={styles.progressText}>
                          {category.percentage.toFixed(0)}%
                        </ThemedText>
                      </View>
                      </View>
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
            <LinearGradient
              colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.chartCardGradient}
              pointerEvents="none"
            />
            <View style={styles.chartHeader}>
              <View style={styles.chartIcon}>
                <ThemedText style={styles.chartIconText}>📊</ThemedText>
              </View>
              <ThemedText style={styles.chartTitle}>{language === 'it' ? 'Distribuzione per categoria' : 'Category distribution'}</ThemedText>
            </View>
            <View style={styles.chartContainer}>
              <ExpensesPie 
                key={`${curYear}-${curMonth}-${categoryUpdateTrigger}-${JSON.stringify(effectiveCategories)}`}
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
              <View style={styles.headerActions}>
                <Pressable 
                  style={styles.resetButton}
                  onPress={() => setShowResetModal(true)}
                  disabled={refreshing || isTransitioning}
                >
                  <ThemedText style={[
                    styles.resetButtonText,
                    (refreshing || isTransitioning) && styles.resetButtonTextDisabled
                  ]}>
                    🗑️ Reset
                  </ThemedText>
                </Pressable>
                <Pressable 
                  style={styles.syncButton}
                  onPress={syncFromNotifications}
                  disabled={refreshing || isTransitioning}
                >
                  <ThemedText style={[
                    styles.syncButtonText,
                    (refreshing || isTransitioning) && styles.syncButtonTextDisabled
                  ]}>
                    📱 Sync{pendingExpensesCount > 0 ? ` (${pendingExpensesCount})` : ''}
                  </ThemedText>
                </Pressable>
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
          </View>
            <ThemedText style={styles.sectionSubtitle}>
              {allMonthTransactions.length} {allMonthTransactions.length !== 1 ? t('transactions') : t('transaction')} • {language === 'it' ? 'Ultimo aggiornamento' : 'Last update'}: {new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
          
          {allMonthTransactions.length > 0 ? (
            <View style={styles.transactionsList}>
              {allMonthTransactions.slice(0, visibleTransactionsCount).map((transaction, index) => (
                <Animated.View
                  key={transaction.id ?? index}
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
                    onPress={() => transaction.type === 'expense' ? handleTransactionPress(transaction.originalData) : handleIncomePress(transaction.originalData)}
                    onPressIn={() => {
                      Animated.spring(scaleAnim1, { toValue: 0.98, useNativeDriver: true }).start()
                    }}
                    onPressOut={() => {
                      Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()
                    }}
                  >
                    {(() => {
                      const isIncome = transaction.type === 'income'
                      const categoryColor = transaction.categoryColor
                      
                      return (
                        <Card variant="subtle" style={styles.transactionCard}>
                          <LinearGradient
                            colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.transactionCardGradient}
                            pointerEvents="none"
                          />
                          <View style={styles.transactionContent}>
                            <View style={styles.transactionLeft}>
                              <View style={[
                                styles.categoryBadge, 
                                { 
                                  backgroundColor: `${categoryColor}20`,
                                  borderColor: `${categoryColor}40`,
                                  borderWidth: 1,
                                  marginRight: 12,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: 12,
                                }
                              ]}>
                                <ThemedText style={[styles.categoryBadgeText, { color: categoryColor, fontSize: 20 }]} numberOfLines={1} ellipsizeMode="tail">
                                  {transaction.categoryIcon}
                                </ThemedText>
                              </View>
                              <View style={styles.transactionText}>
                                <View style={styles.transactionTitleRow}>
                                  <ThemedText style={[
                                    styles.transactionMerchant,
                                    { color: categoryColor }
                                  ]}>
                                    {transaction.description ?? '—'}
                                  </ThemedText>
                                </View>
                            <View style={styles.transactionDateRow}>
                              <ThemedText style={styles.transactionDate}>
                                {formatDateWithLocale(transaction.date, language, locale)}
                              </ThemedText>
                            </View>
                          </View>
                        </View>
                        <View style={styles.transactionRight}>
                          <ThemedText style={[
                            styles.transactionAmount, 
                            isIncome ? { color: Brand.colors.semantic.success } : { color: Brand.colors.semantic.danger }
                          ]}>
                            {isIncome ? '+' : '-'}{Math.abs(transaction.amount).toLocaleString(locale, { style: 'currency', currency })}
                          </ThemedText>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => isIncome ? handleDeleteIncome(transaction.originalData) : handleDeleteTransaction(transaction.originalData)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <ThemedText style={styles.deleteButtonText}>🗑️</ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Card>
                  )
                })()}
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
                colors={UI_CONSTANTS.GRADIENT_CYAN_BG_CARD}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  {selectedTransaction?.type === 'income' 
                    ? (language === 'it' ? 'Seleziona Categoria Entrata' : 'Select Income Category')
                    : (language === 'it' ? 'Seleziona Categoria' : 'Select Category')
                  }
                </ThemedText>
                <Pressable onPress={closeCategoryModal} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </Pressable>
              </View>
              
              <View style={styles.transactionInfo}>
                <ThemedText style={styles.transactionInfoMerchant}>
                  {selectedTransaction?.merchant ?? '—'}
                </ThemedText>
                <View style={styles.transactionAmountRow}>
                  {(() => {
                    const isIncome = selectedTransaction?.type === 'income'
                    const amountValue = Math.abs(selectedTransaction?.amount ?? 0)
                    const amountColor = isIncome ? Brand.colors.semantic.success : Brand.colors.semantic.danger
                    const amountSign = isIncome ? '+' : '-'

                    return (
                      <ThemedText
                        style={[
                          styles.transactionInfoAmount,
                          { color: amountColor }
                        ]}
                      >
                        {amountSign}
                        {amountValue.toLocaleString(locale, { style: 'currency', currency })}
                      </ThemedText>
                    )
                  })()}
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
                  {selectedTransaction?.type === 'income'
                    ? (language === 'it' ? 'La categoria verrà applicata a questa entrata' : 'Category will be applied to this income')
                    : (language === 'it' ? `La categoria verrà applicata a ${items.filter(item => item.merchant === selectedTransaction?.merchant).length} transazioni di questo merchant` : `Category will be applied to ${items.filter(item => item.merchant === selectedTransaction?.merchant).length} transactions from this merchant`)
                  }
                </ThemedText>
              </View>

              <ScrollView 
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.categoriesGrid}>
                  {getAvailableCategories().map((category, index) => (
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
                        onPress={() => handleCategorySelect((category as any).id || category.name)}
                      >
                        <LinearGradient
                          colors={[`${category.color}15`, `${category.color}08`]}
                          style={styles.categoryOptionGradient}
                        >
                          <View style={[styles.categoryOptionIcon, { backgroundColor: `${category.color}20` }]}>
                            <ThemedText style={styles.categoryOptionIconText}>{category.icon}</ThemedText>
                          </View>
                          <ThemedText style={styles.categoryOptionName}>{category.name}</ThemedText>
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
                colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
                pointerEvents="none"
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  {selectedHistoryCategory ? `${selectedHistoryCategory}` : ''}
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
                    <ActivityIndicator color={Brand.colors.primary.cyan} />
                  </View>
                ) : categoryHistory.length === 0 ? (
                  <View style={{ padding: 16 }}>
                    <ThemedText style={{ color: Brand.colors.text.secondary }}>
                      {language === 'it' ? 'Nessuna transazione trovata' : 'No transactions found'}
                    </ThemedText>
                  </View>
                ) : (
                  categoryHistory.map(tx => {
                    // Trova il colore della categoria selezionata
                    const categoryColor = tx.categories?.color || dbCategories.find(cat => 
                      cat.name.toLowerCase() === selectedHistoryCategory?.toLowerCase()
                    )?.color
                    
                    return (
                      <View 
                        key={tx.id} 
                        style={[
                          styles.listItemCard, 
                          { 
                            marginBottom: 10,
                            backgroundColor: categoryColor ? `${categoryColor}15` : undefined,
                            borderColor: categoryColor ? `${categoryColor}30` : undefined
                          }
                        ]}
                      > 
                        <View style={styles.listItemRow}>
                          <View style={{ flex: 1 }}>
                            <ThemedText 
                              style={[
                                styles.listItemMerchant,
                                categoryColor && { color: categoryColor }
                              ]}
                            >
                              {tx.merchant || '—'}
                            </ThemedText>
                            <ThemedText style={styles.listItemDate}>
                              {new Date(tx.date).toLocaleDateString(locale)}
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.listItemAmount, { color: tx.amount >= 0 ? Brand.colors.semantic.success : Brand.colors.semantic.danger }]}> 
                            {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toLocaleString(locale, { style: 'currency', currency })}
                          </ThemedText>
                        </View>
                      </View>
                    )
                  })
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
                colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
                pointerEvents="none"
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>
                  {incomeToDelete ? (language === 'it' ? 'Elimina entrata' : 'Delete income') : t('delete_transaction')}
                </ThemedText>
              </View>
              <View style={{ alignItems: 'center', padding: 16 }}>
                <ThemedText style={styles.modalMessage}>
                  {incomeToDelete 
                    ? (language === 'it' ? 'Sei sicuro di voler eliminare questa entrata?' : 'Are you sure you want to delete this income?')
                    : t('delete_confirm_text')
                  }
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                <Pressable onPress={() => { setShowConfirmModal(false); setTransactionToDelete(null); setIncomeToDelete(null) }} style={[styles.modalButton, { backgroundColor: UI_CONSTANTS.GLASS_BG_SM, borderColor: UI_CONSTANTS.GLASS_BORDER_SM }] }>
                  <ThemedText style={styles.modalButtonText}>{t('cancel')}</ThemedText>
                </Pressable>
                <Pressable onPress={async () => {
                  try {
                    if (transactionToDelete?.id) {
                      // Handle expense deletion
                      const { error } = await deleteExpense(transactionToDelete.id!)
                      if (error) throw error
                      
                      // Update items list
                      setItems(prev => prev.filter(i => i.id !== transactionToDelete.id))
                      
                      // Update month dataset for pie chart
                      setAllMonthItems(prev => prev.filter(i => i.id !== transactionToDelete.id))
                      
                      // Force pie chart update
                      setCategoryUpdateTrigger(prev => prev + 1)
                    } else if (incomeToDelete?.id) {
                      // Handle income deletion
                      const { error } = await supabase
                        .from('incomes')
                        .delete()
                        .eq('user_id', user!.id)
                        .eq('id', incomeToDelete.id)
                      
                      if (error) throw error

                      // Update local state
                      setIncomes(prev => prev.filter(it => it.id !== incomeToDelete.id))
                    }
                    
                    setShowConfirmModal(false)
                    setTransactionToDelete(null)
                    setIncomeToDelete(null)
                    
                  } catch (e) {
                    Alert.alert('Errore', 'Impossibile eliminare la transazione. Riprova.')
                  }
                }} style={[styles.modalButton, { backgroundColor: UI_CONSTANTS.DANGER_BG, borderColor: UI_CONSTANTS.DANGER_BORDER }]}> 
                  <ThemedText style={[styles.modalButtonText, { color: Brand.colors.semantic.danger }]}>{t('delete')}</ThemedText>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        </View>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}> 
            <Card style={styles.modalCard}>
              <LinearGradient
                colors={[Brand.colors.semantic.danger, UI_CONSTANTS.DANGER_BG, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalGradient}
              />
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Reset Spese</ThemedText>
                <Pressable onPress={() => setShowResetModal(false)} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </Pressable>
              </View>
              <View style={{ alignItems: 'center', padding: 16 }}>
                <ThemedText style={styles.modalMessage}>
                  Sei sicuro di voler eliminare TUTTE le spese? Questa azione non può essere annullata.
                </ThemedText>
                <ThemedText style={[styles.modalMessage, { marginTop: 8, fontSize: 12, color: Brand.colors.semantic.danger }]}>
                  Verranno eliminate {items.length} transazioni
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                <Pressable onPress={() => setShowResetModal(false)} style={[styles.modalButton, { backgroundColor: UI_CONSTANTS.GLASS_BG_SM, borderColor: UI_CONSTANTS.GLASS_BORDER_SM }] }>
                  <ThemedText style={styles.modalButtonText}>Annulla</ThemedText>
                </Pressable>
                <Pressable onPress={handleResetAllExpenses} style={[styles.modalButton, { backgroundColor: UI_CONSTANTS.DANGER_BG, borderColor: UI_CONSTANTS.DANGER_BORDER }]}> 
                  <ThemedText style={[styles.modalButtonText, { color: Brand.colors.semantic.danger }]}>Elimina Tutto</ThemedText>
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
    borderColor: UI_CONSTANTS.SUCCESS_BORDER,
    backgroundColor: UI_CONSTANTS.SUCCESS_BG,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    color: UI_CONSTANTS.SUCCESS_TEXT,
    flex: 1,
  },
  hideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
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
    backgroundColor: UI_CONSTANTS.DANGER_BG,
    borderWidth: 1.5,
    borderColor: UI_CONSTANTS.DANGER_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neonLine: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Brand.colors.semantic.danger,
    shadowColor: Brand.colors.semantic.danger,
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
    color: Brand.colors.semantic.danger,
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
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  kpiGradient: {
    padding: 20,
    alignItems: 'center',
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
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
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
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
  syncButton: {
    width: 60,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI_CONSTANTS.SUCCESS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.SUCCESS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: UI_CONSTANTS.SUCCESS_TEXT,
  },
  syncButtonTextDisabled: {
    opacity: 0.6,
  },
  resetButton: {
    width: 60,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI_CONSTANTS.DANGER_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.DANGER_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.colors.semantic.danger,
  },
  resetButtonTextDisabled: {
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
  categoryColumn: {
    flex: 1,
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    marginBottom: 12,
  },
  categoryPressable: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  categoryGradient: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    overflow: 'hidden',
    position: 'relative',
  },
  categoryGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
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
  incomeSection: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  incomeCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.SUCCESS_BORDER,
    backgroundColor: UI_CONSTANTS.SUCCESS_BG,
    position: 'relative',
    overflow: 'hidden',
  },
  incomeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  incomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  incomeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: UI_CONSTANTS.SUCCESS_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: UI_CONSTANTS.SUCCESS_BORDER,
  },
  incomeIconText: {
    fontSize: 24,
  },
  incomeDetails: {
    flex: 1,
  },
  incomeLabel: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  incomeAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: UI_CONSTANTS.SUCCESS_TEXT,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  incomeCount: {
    fontSize: 12,
    color: Brand.colors.text.tertiary,
    fontWeight: '500',
  },
  chartSection: {
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  chartCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    position: 'relative',
    overflow: 'hidden',
  },
  chartCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
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
    backgroundColor: UI_CONSTANTS.MAGENTA_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.MAGENTA_BORDER,
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
    borderColor: Brand.colors.glass.heavy,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    marginBottom: 1,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  transactionCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
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
    backgroundColor: Brand.colors.glow.cyan,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
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
    borderColor: UI_CONSTANTS.GLASS_BORDER,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  transactionDate: {
    fontSize: 14,
    color: Brand.colors.primary.cyan,
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
    color: Brand.colors.primary.cyan,
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
    backgroundColor: Brand.colors.background.deep,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
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
    opacity: 0.15,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  transactionInfo: {
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
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
    color: Brand.colors.primary.cyan,
  },
  stopRecurringButton: {
    backgroundColor: UI_CONSTANTS.DANGER_BG,
    borderColor: UI_CONSTANTS.DANGER_BORDER,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stopRecurringButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.colors.semantic.danger,
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
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_SM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryNavButtonDisabled: {
    backgroundColor: UI_CONSTANTS.GLASS_BG_XS,
    borderColor: UI_CONSTANTS.GLASS_BORDER_XS,
  },
  summaryNavIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  summaryNavIconDisabled: {
    color: Brand.colors.text.muted,
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
    color: Brand.colors.primary.cyan,
  },
  datePickerIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
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
    backgroundColor: Brand.colors.background.card,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
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
    backgroundColor: Brand.colors.glow.cyan,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_SM,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
    borderWidth: 1,
    borderColor: Brand.colors.glass.medium,
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
    backgroundColor: Brand.colors.glass.medium,
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
    color: Brand.colors.primary.cyan,
    fontWeight: '600',
  },
  // Simple list item styles reused in category history modal
  listItemCard: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_SM
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
    backgroundColor: UI_CONSTANTS.DANGER_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.DANGER_BORDER,
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
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
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


