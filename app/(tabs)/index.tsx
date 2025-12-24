import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/Card';
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding';
import { DEFAULT_CATEGORIES, translateCategoryName } from '@/constants/categories';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import { autoCleanupDuplicates } from '@/services/expense-sync';
import { logger } from '@/services/logger';
import { fetchInvestments } from '@/services/portfolio';
import { Expense } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, DeviceEventEmitter, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
  const { user, loading } = useAuth()
  
  // Auth guard - redirect if not logged in (MUST be before all hooks)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Brand.colors.primary.cyan} />
      </View>
    )
  }

  // Durante logout/redirect mostra caricamento
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Brand.colors.primary.cyan} />
      </View>
    )
  }

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<any[]>([])
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; icon: string; color: string; sort_order: number }[]>([])
  const [kpisState, setKpis] = useState<{ totalInvested: number; totalMarket?: number; monthExpenses: number } | null>(null)
  const kpis = kpisState
  void kpis
  const [hideBalances, setHideBalances] = useState(false)
  const [userDisplayName, setUserDisplayName] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newAmount, setNewAmount] = useState('')
  const [newCategory, setNewCategory] = useState('Other')
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null)
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false)
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
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [incomeToDelete, setIncomeToDelete] = useState<any | null>(null)
  const [transactionToDelete, setTransactionToDelete] = useState<any | null>(null)
  // Recurring fields
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'monthly'>('monthly')
  const [recurringOccurrences, setRecurringOccurrences] = useState<string>('6')
  const [recurringInfinite, setRecurringInfinite] = useState<boolean>(false)
  // Income states
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false)
  const [newIncomeAmount, setNewIncomeAmount] = useState('')
  const [newIncomeCategory, setNewIncomeCategory] = useState('work')
  const [newIncomeDescription, setNewIncomeDescription] = useState('')
  const [newIncomeDate, setNewIncomeDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [showIncomeCalendarModal, setShowIncomeCalendarModal] = useState(false)
  const [submittingIncome, setSubmittingIncome] = useState(false)
  const [incomeFormError, setIncomeFormError] = useState<string | null>(null)
  // Income recurring fields
  const [isIncomeRecurring, setIsIncomeRecurring] = useState(false)
  const [incomeRecurringFrequency, setIncomeRecurringFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [incomeRecurringOccurrences, setIncomeRecurringOccurrences] = useState<string>('6')
  const [incomeRecurringInfinite, setIncomeRecurringInfinite] = useState<boolean>(false)

  // Animation values
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
    
    // Note: Expense synchronization is handled in the Expenses tab to avoid duplicates
    
      const [{ data: inv }, { data: exp }, { data: inc }, { data: profile }, { data: categories }] = await Promise.all([
        fetchInvestments(user.id),
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
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        supabase.from('categories').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
      ])
      setExpenses(exp || [])
      setIncomes(inc || [])
      
      // Carica il nome del profilo
      if (profile?.display_name) {
        setUserDisplayName(profile.display_name)
      }
      // Carica le categorie dalla tabella categories
      let normalizedCats = (categories || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        sort_order: c.sort_order,
      }))
      
      // If no categories exist, create default ones
      if (normalizedCats.length === 0) {
        const DEFAULT_CATEGORIES = [
          { name: 'Food & Drinks', icon: '🍽️', color: Brand.colors.primary.orange, sort_order: 0 },
          { name: 'Transport', icon: '🚗', color: Brand.colors.semantic.success, sort_order: 1 },
          { name: 'Home & Utilities', icon: '🏠', color: Brand.colors.semantic.info, sort_order: 2 },
          { name: 'Entertainment', icon: '🎬', color: Brand.colors.semantic.danger, sort_order: 3 },
          { name: 'Health & Personal', icon: '🏥', color: Brand.colors.primary.magenta, sort_order: 4 },
          { name: 'Miscellaneous', icon: '📦', color: Brand.colors.primary.teal, sort_order: 5 }
        ]
        
        const { data: newCategories, error: createError } = await supabase
          .from('categories')
          .upsert(DEFAULT_CATEGORIES.map(cat => ({
            ...cat,
            user_id: user.id
          })), { onConflict: 'user_id,name' })
          .select()
        
        if (createError) {
          console.error('Error creating default categories:', createError)
        } else {
          normalizedCats = (newCategories || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            sort_order: c.sort_order,
          }))
        }
      }
      
      setDbCategories(normalizedCats)
      
      const totalInvested = (inv || []).reduce((s, it) => s + (it.quantity || 0) * (it.average_price || 0), 0)
      const now = new Date()
      const monthExpenses = (exp || []).filter(e => sameMonth(e.date, now.getFullYear(), now.getMonth())).reduce((s, e) => {
        let expenseAmount = e.amount || 0
        // Se amount è già negativo, è una spesa → usa valore assoluto
        if (expenseAmount < 0) {
          return s + Math.abs(expenseAmount)
        }
        // Se amount è positivo, verifica se è una spesa o un'entrata
        if (expenseAmount > 0) {
          const notificationText = (e.raw_notification || '').toLowerCase()
          const merchantText = (e.merchant || '').toLowerCase()
          const isManual = notificationText === 'manual' || notificationText === ''
          const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
          // Se è manuale o non ha parole chiave di accredito, è una spesa
          if (isManual || !hasIncomeKeywords) {
            return s + Math.abs(expenseAmount)
          }
        }
        return s
      }, 0)
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
    const subSettings = DeviceEventEmitter.addListener('settings:categoriesUpdated', () => {
      loadData()
    })
    const subDuplicates = DeviceEventEmitter.addListener('expenses:duplicatesRemoved', () => {
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
      try { subSettings.remove() } catch {}
      try { subDuplicates.remove() } catch {}
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [user?.id, loadData])


  // Calculate financial data
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1
  const prevYear = curMonth === 0 ? curYear - 1 : curYear

  const currentMonthExpenses = expenses.filter(e => sameMonth(e.date, curYear, curMonth)).reduce((s, e) => {
    let expenseAmount = e.amount || 0
    // Se amount è già negativo, è una spesa → usa valore assoluto
    if (expenseAmount < 0) {
      return s + Math.abs(expenseAmount)
    }
    // Se amount è positivo, verifica se è una spesa o un'entrata
    if (expenseAmount > 0) {
      const notificationText = (e.raw_notification || '').toLowerCase()
      const merchantText = (e.merchant || '').toLowerCase()
      const isManual = notificationText === 'manual' || notificationText === ''
      const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
      // Se è manuale o non ha parole chiave di accredito, è una spesa
      if (isManual || !hasIncomeKeywords) {
        return s + Math.abs(expenseAmount)
      }
    }
    return s
  }, 0)
  const previousMonthExpenses = expenses.filter(e => sameMonth(e.date, prevYear, prevMonth)).reduce((s, e) => {
    let expenseAmount = e.amount || 0
    // Se amount è già negativo, è una spesa → usa valore assoluto
    if (expenseAmount < 0) {
      return s + Math.abs(expenseAmount)
    }
    // Se amount è positivo, verifica se è una spesa o un'entrata
    if (expenseAmount > 0) {
      const notificationText = (e.raw_notification || '').toLowerCase()
      const merchantText = (e.merchant || '').toLowerCase()
      const isManual = notificationText === 'manual' || notificationText === ''
      const hasIncomeKeywords = !isManual && /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund/i.test(notificationText + ' ' + merchantText)
      // Se è manuale o non ha parole chiave di accredito, è una spesa
      if (isManual || !hasIncomeKeywords) {
        return s + Math.abs(expenseAmount)
      }
    }
    return s
  }, 0)
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

  const tCategory = (name: string) => translateCategoryName(name, language)

  // Shorten category name to max characters from branding
  const shortenCategoryName = (name: string) => {
    const translated = tCategory(name)
    return translated.length > UI_CONSTANTS.CATEGORY_MAX_LENGTH ? translated.slice(0, UI_CONSTANTS.CATEGORY_MAX_LENGTH) + '…' : translated
  }

  // Check if a date is today
  const isToday = (dateStr: string) => {
    if (!dateStr) return false
    const today = new Date()
    const transactionDate = new Date(dateStr)
    
    return today.getFullYear() === transactionDate.getFullYear() &&
           today.getMonth() === transactionDate.getMonth() &&
           today.getDate() === transactionDate.getDate()
  }

  const availableCategories = (dbCategories?.length ? dbCategories : DEFAULT_CATEGORIES.map(c => ({ id: `temp-${c.name}`, name: c.name, color: c.color, icon: c.icon, sort_order: 0 })))

  // Set default category ID when categories are loaded
  useEffect(() => {
    if (dbCategories.length > 0 && !newCategoryId) {
      const otherCategory = dbCategories.find(c => c.name.toLowerCase() === 'other')
      if (otherCategory) {
        setNewCategoryId(otherCategory.id)
      }
    }
  }, [dbCategories, newCategoryId])

  // Auto-assign category when merchant name is entered (remember category for same store)
  useEffect(() => {
    const loadCategoryForMerchant = async () => {
      if (!user || !newTitle || newTitle.trim().length === 0 || !dbCategories.length) return
      
      // Don't auto-assign if user has manually selected a category
      if (categoryManuallySelected) return
      
      try {
        // Try to find existing category for this merchant
        const { data: existingExpense } = await supabase
          .from('expenses')
          .select('category_id')
          .eq('user_id', user.id)
          .eq('merchant', newTitle.trim())
          .not('category_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (existingExpense?.category_id) {
          // Find the category details
          const category = dbCategories.find(c => c.id === existingExpense.category_id)
          if (category) {
            setNewCategoryId(category.id)
            setNewCategory(category.name)
          }
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.error('Error loading category for merchant:', error)
      }
    }

    // Debounce the search to avoid too many queries
    const timeoutId = setTimeout(() => {
      loadCategoryForMerchant()
    }, 300) // Wait 300ms after user stops typing

    return () => clearTimeout(timeoutId)
  }, [newTitle, user, dbCategories, categoryManuallySelected])

  // Reset manual selection flag when modal is closed
  useEffect(() => {
    if (!showAddModal) {
      setCategoryManuallySelected(false)
    }
  }, [showAddModal])

  const openRecentCategoryModal = (tx: Expense) => {
    setSelectedTransaction({ ...tx, type: 'expense' })
    setShowCategoryModal(true)
  }

  const openRecentIncomeCategoryModal = (income: any) => {
    setSelectedTransaction({ ...income, type: 'income' })
    setShowCategoryModal(true)
  }

  const applyCategoryToMerchant = useCallback(async (categoryId: string, isIncome: boolean) => {
    if (!selectedTransaction || !user) return
    const merchant = selectedTransaction.merchant || selectedTransaction.description
    if (!merchant) return

    const table = isIncome ? 'incomes' : 'expenses'
    const merchantField = isIncome ? 'description' : 'merchant'
    const payload = isIncome ? { category: categoryId } : { category_id: categoryId }

    await supabase
      .from(table)
      .update(payload)
      .eq('user_id', user.id)
      .ilike(merchantField, merchant)
  }, [selectedTransaction, user])

  const closeCategoryModal = useCallback(() => {
    setShowCategoryModal(false)
    setSelectedTransaction(null)
  }, [])

  const handleCategorySelect = useCallback(async (categoryId: string) => {
    if (!selectedTransaction || !user) return

    try {
      if (selectedTransaction.type === 'income') {
        const { error } = await supabase
          .from('incomes')
          .update({ category: categoryId })
          .eq('user_id', user.id)
          .eq('id', selectedTransaction.id)
        if (error) throw error

        await applyCategoryToMerchant(categoryId, true)
      } else {
        const { error } = await supabase
          .from('expenses')
          .update({ category_id: categoryId })
          .eq('user_id', user.id)
          .eq('id', selectedTransaction.id)
        if (error) throw error

        await applyCategoryToMerchant(categoryId, false)
      }

      await loadData()
      DeviceEventEmitter.emit('expenses:externalUpdate')
      closeCategoryModal()
    } catch (error) {
      console.error('[Home] Failed to update category', error)
    }
  }, [selectedTransaction, user, loadData, closeCategoryModal])

  const handleDeleteIncome = async (income: any) => {
    if (!income.id) {
      console.error('Cannot delete income without ID')
      return
    }

    setShowConfirmModal(true)
    setIncomeToDelete(income)
  }

  const handleDeleteExpense = async (expense: any) => {
    if (!expense.id) {
      console.error('Cannot delete expense without ID')
      return
    }

    setShowConfirmModal(true)
    setTransactionToDelete(expense)
  }

  // Combine expenses and incomes for recent transactions
  const allTransactions = useMemo(() => {
    // Process expenses: amount < 0 = spesa, amount > 0 con parole chiave accredito = entrata
    const expenseTransactions = expenses.map(expense => {
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
        originalData: expense
      }
    })

    const incomeTransactions = incomes.map(income => ({
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
                    income.category === 'investment' ? Brand.colors.primary.orange : Brand.colors.primary.teal,
      date: income.date,
      created_at: income.created_at,
      isRecurring: income.is_recurring,
      raw_notification: 'manual',
      originalData: income
    }))

    return [...expenseTransactions, ...incomeTransactions]
  }, [expenses, incomes])

  // Ensure consistent ordering client-side as a fallback
  const sortedTransactions = useMemo(() => {
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

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day
    
    // Filtra le transazioni:
    // 1. Precedenti o uguali alla data corrente (incluso oggi)
    // 2. Del mese della data selezionata (sempre)
    const filteredTransactions = allTransactions.filter(transaction => {
      const transactionDate = parseDate(transaction.date)
      const transactionDateObj = new Date(transactionDate)
      const selectedDate = new Date(newDate)
      
      // Includi sempre le transazioni del mese della data selezionata
      const isInSelectedMonth = transactionDateObj.getFullYear() === selectedDate.getFullYear() && 
                               transactionDateObj.getMonth() === selectedDate.getMonth()
      
      // Includi le transazioni precedenti o uguali alla data corrente (incluso oggi)
      const isTodayOrBefore = transactionDate <= today.getTime()
      
      return isInSelectedMonth || isTodayOrBefore
    })

    return [...filteredTransactions].sort((a, b) => {
      const da = parseDate(a.date)
      const db = parseDate(b.date)
      if (db !== da) return db - da
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0
      return cb - ca
    })
  }, [allTransactions, newDate])

  return (
    <View style={styles.container}>
      {/* Background gradient aligned to theme */}
      <LinearGradient
          colors={[Brand.colors.background.elevated, Brand.colors.background.deep, Brand.colors.background.deep]}
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
                <LinearGradient
                  colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.overviewCardGradient}
                  pointerEvents="none"
                />
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
                      borderColor: expenseDelta >= 0 ? UI_CONSTANTS.DANGER_BORDER : UI_CONSTANTS.SUCCESS_BORDER,
                    }]}>
                      <ThemedText style={[styles.overviewBadgeIcon, { color: expenseDelta >= 0 ? Brand.colors.semantic.danger : UI_CONSTANTS.SUCCESS_TEXT }]}> 
                        {expenseDelta >= 0 ? '↗' : '↘'}
                      </ThemedText>
                      <ThemedText type="label" style={[styles.overviewBadgeText, { color: expenseDelta >= 0 ? Brand.colors.semantic.danger : UI_CONSTANTS.SUCCESS_TEXT }]}> 
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
          <View style={styles.fabRow}>
          <Pressable
            style={({ pressed }) => [
              styles.fab,
                styles.fabExpense,
              pressed && { transform: [{ scale: 0.98 }] }
            ]}
            onPress={() => setShowAddModal(true)}
          >
            <LinearGradient
                colors={['rgba(239, 68, 68, 0.12)', 'rgba(239, 68, 68, 0.06)']}
              start={{ x: 1.1, y: 1.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.fabGradient}
            />
              <ThemedText style={[styles.fabIcon, { color: Brand.colors.semantic.danger }]}>－</ThemedText>
              <ThemedText style={styles.fabLabel}>{language === 'it' ? 'Spesa' : 'Expense'}</ThemedText>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.fab,
                styles.fabIncome,
                pressed && { transform: [{ scale: 0.98 }] }
              ]}
              onPress={() => setShowAddIncomeModal(true)}
            >
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.06)']}
                start={{ x: 1.1, y: 1.1 }}
                end={{ x: 0.9, y: 0.9 }}
                style={styles.fabGradient}
              />
              <ThemedText style={[styles.fabIcon, { color: Brand.colors.semantic.success }]}>＋</ThemedText>
              <ThemedText style={styles.fabLabel}>{language === 'it' ? 'Entrata' : 'Income'}</ThemedText>
          </Pressable>
          </View>
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
            <LinearGradient
              colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.recentCardGradient}
              pointerEvents="none"
            />
            <View style={styles.recentHeader}>
              <ThemedText style={styles.recentTitle}>
                {language === 'it' ? 'Transazioni recenti' : 'Recent transactions'}
              </ThemedText>
              <ThemedText style={styles.recentCount}>
             {/*   {allTransactions.length} {language === 'it' ? 'transazioni' : 'transactions'} */}
              </ThemedText>
            </View>
            <View style={styles.recentList}>
              {sortedTransactions.slice(0, UI_CONSTANTS.RECENT_TRANSACTIONS_LIMIT).map((tx, idx) => {
                const clr = tx.categoryColor
                const isIncome = tx.type === 'income'
                
                return (
                  <TouchableOpacity 
                    key={tx.id ?? idx} 
                    style={[
                      styles.recentItem,
                      {
                        backgroundColor: `${clr}08`,
                        borderBottomColor: `${clr}20`
                      }
                    ]}
                    onPress={() => isIncome ? openRecentIncomeCategoryModal(tx.originalData) : openRecentCategoryModal(tx.originalData)}
                    hitSlop={UI_CONSTANTS.HIT_SLOP_MEDIUM as any}
                  >
                    <View style={styles.recentLeft}>
                      <View style={[
                        styles.homeCategoryBadge, 
                        { 
                          backgroundColor: `${clr}20`, 
                          borderColor: `${clr}40`, 
                          marginRight: 10 
                        }
                      ]}>
                        <ThemedText style={[styles.homeCategoryBadgeText, { color: clr }]} numberOfLines={1}>
                          {tx.categoryIcon}
                        </ThemedText>
                      </View>
                      <View style={styles.recentTextBlock}>
                        <ThemedText 
                          style={[
                            styles.recentMerchant, 
                            { color: clr }
                          ]} 
                          numberOfLines={1}
                        >
                          {tx.description || '—'}
                        </ThemedText>
                        <ThemedText style={styles.recentDate}>
                          {isToday(tx.date) 
                            ? (language === 'it' ? 'Oggi' : 'Today')
                            : new Date(tx.date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short' })
                          }
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.recentRight}>
                      <ThemedText style={[
                        styles.recentAmount, 
                        isIncome ? { color: Brand.colors.semantic.success } : { color: Brand.colors.semantic.danger }
                      ]}> 
                        {isIncome ? '+' : '-'}{Math.abs(tx.amount).toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency: 'EUR' })}
                      </ThemedText>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => isIncome ? handleDeleteIncome(tx.originalData) : handleDeleteExpense(tx.originalData)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <ThemedText style={styles.deleteButtonText}>🗑️</ThemedText>
                    </TouchableOpacity>
                  </View>
                  </TouchableOpacity>
                )
              })}
              {allTransactions.length === 0 && (
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
        <View style={[styles.modalOverlay, { backgroundColor: UI_CONSTANTS.MODAL_OVERLAY_DARK }]}> 
          <View style={styles.addModalCard}>
            <LinearGradient
              colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
              style={styles.addModalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
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
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              <View style={styles.formRow}>
                <ThemedText style={styles.formLabel}>{t('title')}</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder={t('title') +' '+ t('transaction')}
                  placeholderTextColor={Brand.colors.text.tertiary}
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('amount')}</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Brand.colors.text.tertiary}
                keyboardType="decimal-pad"
                value={newAmount}
                onChangeText={setNewAmount}
              />
            </View>
              <View style={styles.formRow}>
                <ThemedText style={styles.formLabel}>{t('category')}</ThemedText>
                <View style={styles.categoryGrid}>
                  {availableCategories.map((c) => {
                    const isSelected = newCategory.toLowerCase() === c.name.toLowerCase()
                    return (
                      <TouchableOpacity
                        key={c.id || c.name}
                        style={[
                          styles.categoryChip, 
                          isSelected && styles.categoryChipActive,
                          { 
                            borderColor: (c.color || UI_CONSTANTS.GLASS_BORDER_MD),
                            backgroundColor: isSelected && c.color ? `${c.color}20` : undefined,
                            width: '31%', // Esattamente 3 per riga con gap
                            marginBottom: 8,
                          }
                        ]}
                        onPress={() => {
                          setNewCategory(c.name)
                          setNewCategoryId(c.id)
                          setCategoryManuallySelected(true) // Mark as manually selected
                        }}
                      >
                        <ThemedText 
                          style={[
                            styles.categoryChipText, 
                            isSelected && styles.categoryChipTextActive,
                            isSelected && c.color && { color: c.color }
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {c.icon ? `${c.icon} ` : ''}{shortenCategoryName(c.name)}
                        </ThemedText>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('date')}</ThemedText>
              <Pressable style={styles.input} onPress={() => setShowCalendarModal(true)}>
                <ThemedText style={{ color: Brand.colors.text.primary }}>{newDate}</ThemedText>
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
                placeholderTextColor={Brand.colors.text.tertiary}
                      value={recurringOccurrences}
                      onChangeText={setRecurringOccurrences}
                    />
                  </View>
                )}
              </>
            )}
            </ScrollView>

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
                  // Auto-assign category if merchant already has one
                  let finalCategoryId = newCategoryId
                  if (!finalCategoryId && newTitle) {
                    // Try to find existing category for this merchant
                    const { data: existingExpense } = await supabase
                      .from('expenses')
                      .select('category_id')
                      .eq('user_id', user.id)
                      .eq('merchant', newTitle.trim())
                      .not('category_id', 'is', null)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single()
                    
                    if (existingExpense?.category_id) {
                      finalCategoryId = existingExpense.category_id
                      // Update UI state to show the auto-selected category
                      setNewCategoryId(finalCategoryId)
                    }
                  }
                  
                  const items: any[] = []
                  if (isRecurring) {
                    const count = recurringInfinite ? 1 : Math.min(36, Math.max(1, parseInt(recurringOccurrences || '1', 10) || 1))
                    const selectedDate = new Date(newDate)
                    const today = new Date()
                    today.setHours(0, 0, 0, 0) // Reset time to start of day
                    
                    // Usa sempre la data selezionata come data di partenza
                    let start: Date = new Date(selectedDate)
                    
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
                        category_id: finalCategoryId,
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
                      category_id: finalCategoryId,
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
                  
                  // For infinite recurring transactions, generate future occurrences immediately
                  if (isRecurring && recurringInfinite) {
                    try {
                      await supabase.rpc('generate_recurring_expenses_rpc', { horizon_days: 60 })
                    } catch (rpcError: any) {
                      // Log but don't fail the transaction if RPC fails
                      if (logger && logger.error) {
                        logger.error('Failed to generate recurring expenses', { error: rpcError?.message }, 'Home')
                      }
                    }
                  }
                  
                  // Pulizia automatica dei duplicati dopo il salvataggio
                  await autoCleanupDuplicates(user.id)
                  
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
                  
                  // For recurring transactions, add a small delay and force refresh
                  if (isRecurring) {
                    setTimeout(async () => {
                      await loadData()
                      DeviceEventEmitter.emit('expenses:externalUpdate')
                    }, 500)
                  }
                  setNewAmount('')
                  setNewCategory('Other')
                  setNewCategoryId(null)
                  setCategoryManuallySelected(false) // Reset manual selection flag
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

      {/* Category Selection Modal (Recent Transactions) */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
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
                  {selectedTransaction?.type === 'income'
                    ? (language === 'it' ? 'Seleziona categoria entrata' : 'Select income category')
                    : (language === 'it' ? 'Seleziona categoria' : 'Select category')}
                </ThemedText>
                <Pressable onPress={closeCategoryModal} style={styles.closeButton}>
                  <ThemedText style={styles.closeButtonText}>✕</ThemedText>
                </Pressable>
              </View>

              <View style={styles.transactionInfo}>
                <ThemedText style={styles.transactionInfoMerchant}>
                  {selectedTransaction?.merchant || selectedTransaction?.description || '—'}
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
                        {amountValue.toLocaleString(language === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency: 'EUR' })}
                      </ThemedText>
                    )
                  })()}
                </View>
                <ThemedText style={styles.transactionInfoNote}>
                  {(() => {
                    const isIncome = selectedTransaction?.type === 'income'
                    const merchant = (selectedTransaction as any)?.merchant || selectedTransaction?.description || ''
                    const sameMerchantCount = allTransactions.filter(
                      t => ((t as any).merchant || t.description || '').toLowerCase() === merchant.toLowerCase()
                        && (isIncome ? t.type === 'income' : t.type === 'expense')
                    ).length

                    if (language === 'it') {
                      return sameMerchantCount > 1
                        ? `La categoria verrà applicata a ${sameMerchantCount} transazioni di questo merchant`
                        : 'La categoria verrà applicata a questa transazione.'
                    }
                    return sameMerchantCount > 1
                      ? `The category will be applied to ${sameMerchantCount} transactions from this merchant`
                      : 'The category will be applied to this transaction.'
                  })()}
                </ThemedText>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.categoriesGrid}>
                  {availableCategories.map((c, index) => (
                    <Animated.View
                      key={c.id || c.name}
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
                          { borderColor: c.color || Brand.colors.glass.heavy }
                        ]}
                        onPress={() => handleCategorySelect(c.id || c.name)}
                      >
                        <LinearGradient
                          colors={[c.color ? `${c.color}22` : Brand.colors.glass.heavy, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                          style={styles.categoryOptionGradient}
                        >
                          <View style={[styles.categoryOptionIcon, { backgroundColor: c.color ? `${c.color}20` : UI_CONSTANTS.GLASS_BG_MD }]}>
                            <ThemedText style={styles.categoryOptionIconText}>{c.icon || '🏷️'}</ThemedText>
                          </View>
                          <ThemedText style={styles.categoryOptionName} numberOfLines={1}>
                            {c.name}
                          </ThemedText>
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              </ScrollView>
            </Card>
          </View>
        </View>
      </Modal>

      {/* Add Income Modal */}
      <Modal
        visible={showAddIncomeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddIncomeModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: UI_CONSTANTS.MODAL_OVERLAY_DARK }]}> 
          <View style={styles.addModalCard}>
            <LinearGradient
              colors={[ 'rgba(16,185,129,0.10)', 'rgba(34,197,94,0.06)', 'transparent' ]}
              style={styles.addModalGradient}
            />
            <View style={styles.addModalHeader}>
              <ThemedText style={styles.addModalTitle}>{language === 'it' ? 'Aggiungi Entrata' : 'Add Income'}</ThemedText>
              <Pressable onPress={() => setShowAddIncomeModal(false)} style={styles.addModalClose}>
                <ThemedText style={styles.addModalCloseText}>✕</ThemedText>
              </Pressable>
            </View>
            {!!incomeFormError && (
              <View style={styles.errorBox}>
                <ThemedText style={styles.errorTitle}>{t('error_prefix')}{incomeFormError}</ThemedText>
              </View>
            )}
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{language === 'it' ? 'Descrizione' : 'Description'}</ThemedText>
              <TextInput
                style={styles.input}
                placeholder={language === 'it' ? 'Stipendio, freelance...' : 'Salary, freelance...'}
                placeholderTextColor={Brand.colors.text.tertiary}
                value={newIncomeDescription}
                onChangeText={setNewIncomeDescription}
              />
            </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('amount')}</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={Brand.colors.text.tertiary}
                keyboardType="decimal-pad"
                value={newIncomeAmount}
                onChangeText={setNewIncomeAmount}
              />
            </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{language === 'it' ? 'Categoria' : 'Category'}</ThemedText>
              <View style={styles.categoryRow}>
                {[
                  { key: 'work', label: language === 'it' ? 'Lavoro' : 'Work', icon: '💼' },
                  { key: 'passive', label: language === 'it' ? 'Passiva' : 'Passive', icon: '🏠' },
                  { key: 'investment', label: language === 'it' ? 'Investimenti' : 'Investment', icon: '📈' },
                  { key: 'other', label: language === 'it' ? 'Altro' : 'Other', icon: '💰' }
                ].map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.categoryChip, 
                      newIncomeCategory === category.key && styles.categoryChipActive,
                      { 
                        borderColor: newIncomeCategory === category.key ? Brand.colors.semantic.success : UI_CONSTANTS.GLASS_BORDER_MD,
                        backgroundColor: newIncomeCategory === category.key ? 'rgba(16,185,129,0.20)' : undefined
                      }
                    ]}
                    onPress={() => setNewIncomeCategory(category.key)}
                  >
                    <ThemedText 
                      style={[
                        styles.categoryChipText, 
                        newIncomeCategory === category.key && styles.categoryChipTextActive,
                        newIncomeCategory === category.key && { color: Brand.colors.semantic.success }
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {category.icon} {category.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formRow}>
              <ThemedText style={styles.formLabel}>{t('date')}</ThemedText>
              <Pressable style={styles.input} onPress={() => setShowIncomeCalendarModal(true)}>
                <ThemedText style={{ color: Brand.colors.text.primary }}>{newIncomeDate}</ThemedText>
              </Pressable>
            </View>

            {/* Income Recurring Controls */}
            <View style={styles.formRow}>
              <TouchableOpacity
                onPress={() => setIsIncomeRecurring(!isIncomeRecurring)}
                style={[styles.toggleRow, isIncomeRecurring && styles.toggleRowActive]}
              >
                <View style={[styles.toggleIndicator, isIncomeRecurring && styles.toggleIndicatorOn]} />
                <ThemedText style={[styles.toggleLabel, isIncomeRecurring && styles.toggleLabelActive]}>
                  {language === 'it' ? 'Entrata ricorrente' : 'Recurring income'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {isIncomeRecurring && (
              <>
                <View style={styles.formRow}>
                  <ThemedText style={styles.formLabel}>{language === 'it' ? 'Frequenza' : 'Frequency'}</ThemedText>
                  <View style={styles.categoryRow}>
                    {(['monthly','weekly','yearly'] as const).map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[styles.categoryChip, incomeRecurringFrequency === freq && !incomeRecurringInfinite && styles.categoryChipActive]}
                        onPress={() => {
                          setIncomeRecurringFrequency(freq);
                          setIncomeRecurringInfinite(false);
                        }}
                      >
                        <ThemedText style={[styles.categoryChipText, incomeRecurringFrequency === freq && !incomeRecurringInfinite && styles.categoryChipTextActive]}>
                          {freq === 'monthly' ? (language === 'it' ? 'Mensile' : 'Monthly') :
                           freq === 'weekly' ? (language === 'it' ? 'Settimanale' : 'Weekly') :
                           (language === 'it' ? 'Annuale' : 'Yearly')}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                    {/* Infinite toggle chip */}
                    <TouchableOpacity
                      key="infinite"
                      style={[styles.categoryChip, incomeRecurringInfinite && styles.categoryChipActive]}
                      onPress={() => {
                        setIncomeRecurringInfinite(!incomeRecurringInfinite);
                        if (!incomeRecurringInfinite) {
                          setIncomeRecurringFrequency('monthly'); // Reset to default when enabling infinite
                        }
                      }}
                    >
                      <ThemedText style={[styles.categoryChipText, incomeRecurringInfinite && styles.categoryChipTextActive]}>
                        {language === 'it' ? 'Senza fine' : 'Never ends'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
                {!incomeRecurringInfinite && (
                  <View style={styles.formRow}>
                    <ThemedText style={styles.formLabel}>{language === 'it' ? 'Occorrenze' : 'Occurrences'}</ThemedText>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      placeholder="6"
                placeholderTextColor={Brand.colors.text.tertiary}
                      value={incomeRecurringOccurrences}
                      onChangeText={setIncomeRecurringOccurrences}
                    />
                  </View>
                )}
              </>
            )}

            {/* Income Calendar Modal */}
            <Modal
              visible={showIncomeCalendarModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowIncomeCalendarModal(false)}
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
                          const isSelected = !isEmpty && newIncomeDate === value
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
                            onPress={() => { setNewIncomeDate(value); setShowIncomeCalendarModal(false) }}
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
                  <Pressable onPress={() => setShowIncomeCalendarModal(false)} style={[styles.submitButton, { marginTop: 12 }]}>
                    <ThemedText style={styles.submitButtonText}>{t('close')}</ThemedText>
                  </Pressable>
                </View>
              </View>
            </Modal>

            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.9 }]}
              onPress={async () => {
                if (!user || submittingIncome) return
                setSubmittingIncome(true)
                try {
                  const amountNum = parseFloat((newIncomeAmount || '').replace(',', '.'))
                  if (!newIncomeDescription || newIncomeDescription.trim().length === 0) {
                    setIncomeFormError(language === 'it' ? 'Descrizione obbligatoria' : 'Description required')
                    return
                  }
                  if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
                    setIncomeFormError(language === 'it' ? 'Importo non valido' : 'Invalid amount')
                    return
                  }
                  if (!newIncomeDate) {
                    setIncomeFormError(language === 'it' ? 'Data obbligatoria' : 'Date required')
                    return
                  }
                  
                  const items: any[] = []
                  if (isIncomeRecurring) {
                    const count = incomeRecurringInfinite ? 1 : Math.min(36, Math.max(1, parseInt(incomeRecurringOccurrences || '1', 10) || 1))
                    const selectedDate = new Date(newIncomeDate)
                    
                    // Usa sempre la data selezionata come data di partenza
                    let start: Date = new Date(selectedDate)
                    
                    const groupId = `rec-income-${user.id}-${Date.now()}`
                    for (let i = 0; i < count; i++) {
                      const d = new Date(start)
                      if (incomeRecurringFrequency === 'monthly') {
                        d.setMonth(d.getMonth() + i)
                      } else if (incomeRecurringFrequency === 'weekly') {
                        d.setDate(d.getDate() + i * 7)
                      } else if (incomeRecurringFrequency === 'yearly') {
                        d.setFullYear(d.getFullYear() + i)
                      }
                      const yyyy = d.getFullYear()
                      const mm = String(d.getMonth() + 1).padStart(2, '0')
                      const dd = String(d.getDate()).padStart(2, '0')
                      items.push({
                        user_id: user.id,
                        amount: amountNum,
                        category: newIncomeCategory,
                        currency: 'EUR',
                        date: `${yyyy}-${mm}-${dd}`,
                        description: newIncomeDescription,
                        is_recurring: true,
                        recurring_group_id: groupId,
                        recurring_frequency: incomeRecurringFrequency,
                        recurring_total_occurrences: incomeRecurringInfinite ? null : count,
                        recurring_index: i + 1,
                        recurring_infinite: incomeRecurringInfinite,
                      })
                    }
                  } else {
                    items.push({
                      user_id: user.id,
                      amount: amountNum,
                      category: newIncomeCategory,
                      currency: 'EUR',
                      date: newIncomeDate,
                      description: newIncomeDescription,
                      is_recurring: false,
                    })
                  }
                  
                  const { error } = await supabase.from('incomes').insert(items)
                  
                  if (error) {
                    if (logger && logger.error) {
                      logger.error('Failed to save income', { error: error.message }, 'Home')
                    }
                    setIncomeFormError(error.message || (language === 'it' ? 'Errore durante il salvataggio' : 'Error saving income'))
                    return
                  }
                  
                  // For infinite recurring incomes, generate future occurrences immediately
                  if (isIncomeRecurring && incomeRecurringInfinite) {
                    try {
                      await supabase.rpc('generate_recurring_incomes_rpc', { horizon_days: 60 })
                    } catch (rpcError: any) {
                      // Log but don't fail the transaction if RPC fails
                      if (logger && logger.error) {
                        logger.error('Failed to generate recurring incomes', { error: rpcError?.message }, 'Home')
                      }
                    }
                  }
                  
                  if (logger && logger.info) {
                    logger.info('Income saved successfully', { 
                      amount: amountNum,
                      category: newIncomeCategory 
                    }, 'Home')
                  }
                  
                  await loadData()
                  DeviceEventEmitter.emit('expenses:externalUpdate')
                  
                  // For recurring incomes, add a small delay and force refresh
                  if (isIncomeRecurring) {
                    setTimeout(async () => {
                      await loadData()
                      DeviceEventEmitter.emit('expenses:externalUpdate')
                    }, 500)
                  }
                  
                  setNewIncomeAmount('')
                  setNewIncomeCategory('work')
                  setNewIncomeDescription('')
                  setNewIncomeDate(new Date().toISOString().split('T')[0])
                  setIsIncomeRecurring(false)
                  setIncomeRecurringFrequency('monthly')
                  setIncomeRecurringOccurrences('6')
                  setIncomeRecurringInfinite(false)
                  setIncomeFormError(null)
                  setShowAddIncomeModal(false)
                  // Show toast
                  const toastMessage = isIncomeRecurring 
                    ? (language === 'it' ? `Entrate ricorrenti aggiunte (${items.length}) ✅` : `Recurring incomes added (${items.length}) ✅`)
                    : (language === 'it' ? 'Entrata aggiunta ✅' : 'Income added ✅')
                  setToast({ visible: true, text: toastMessage })
                  setTimeout(() => setToast({ visible: false, text: '' }), 2000)
                } catch (e: any) {
                  setIncomeFormError(e?.message || (language === 'it' ? 'Impossibile salvare l\'entrata' : 'Unable to save income'))
                } finally {
                  setSubmittingIncome(false)
                }
              }}
            >
              <ThemedText style={styles.submitButtonText}>
                {submittingIncome ? (language === 'it' ? 'Salvando...' : 'Saving...') : (language === 'it' ? 'Aggiungi Entrata' : 'Add Income')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {toast.visible && (
        <View style={styles.toast}>
          <ThemedText style={styles.toastText}>{toast.text}</ThemedText>
        </View>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowConfirmModal(false); setIncomeToDelete(null); setTransactionToDelete(null) }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addModalCard}>
            <View style={styles.addModalHeader}>
              <ThemedText style={styles.addModalTitle}>
                {incomeToDelete ? (language === 'it' ? 'Elimina entrata' : 'Delete income') : (language === 'it' ? 'Elimina spesa' : 'Delete expense')}
              </ThemedText>
              <Pressable onPress={() => { setShowConfirmModal(false); setIncomeToDelete(null); setTransactionToDelete(null) }} style={styles.addModalClose}>
                <ThemedText style={styles.addModalCloseText}>✕</ThemedText>
              </Pressable>
            </View>
            <View style={{ alignItems: 'center', padding: 16 }}>
              <ThemedText style={{ color: Brand.colors.text.primary, textAlign: 'center', fontSize: 16 }}>
                {incomeToDelete ? (language === 'it' ? 'Sei sicuro di voler eliminare questa entrata?' : 'Are you sure you want to delete this income?') : (language === 'it' ? 'Sei sicuro di voler eliminare questa spesa?' : 'Are you sure you want to delete this expense?')}
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <Pressable 
                onPress={() => { setShowConfirmModal(false); setIncomeToDelete(null); setTransactionToDelete(null) }} 
                style={[styles.submitButton, { backgroundColor: 'rgba(100, 100, 100, 0.2)', borderColor: 'rgba(100, 100, 100, 0.3)' }]}
              >
                <ThemedText style={styles.submitButtonText}>{language === 'it' ? 'Annulla' : 'Cancel'}</ThemedText>
              </Pressable>
              <Pressable 
                onPress={async () => {
                  if (!user) return
                  
                  try {
                    if (incomeToDelete?.id) {
                      // Delete income
                      const { error } = await supabase
                        .from('incomes')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('id', incomeToDelete.id)
                      
                      if (error) throw error

                      // Update local state
                      setIncomes(prev => prev.filter(it => it.id !== incomeToDelete.id))

                      // Show toast
                      setToast({ visible: true, text: language === 'it' ? 'Entrata eliminata ✅' : 'Income deleted ✅' })
                    } else if (transactionToDelete?.id) {
                      // Delete expense
                      const { error } = await supabase
                        .from('expenses')
                        .delete()
                        .eq('user_id', user.id)
                        .eq('id', transactionToDelete.id)
                      
                      if (error) throw error

                      // Update local state
                      setExpenses(prev => prev.filter(it => it.id !== transactionToDelete.id))

                      // Show toast
                      setToast({ visible: true, text: language === 'it' ? 'Spesa eliminata ✅' : 'Expense deleted ✅' })
                    } else {
                      return
                    }

                    // Notify other screens
                    DeviceEventEmitter.emit('expenses:externalUpdate')
                    setTimeout(() => setToast({ visible: false, text: '' }), 2000)

                    setShowConfirmModal(false)
                    setIncomeToDelete(null)
                    setTransactionToDelete(null)
                  } catch (e) {
                    console.error('Error deleting transaction:', e)
                    setToast({ visible: true, text: language === 'it' ? 'Errore nell\'eliminazione' : 'Error deleting transaction' })
                    setTimeout(() => setToast({ visible: false, text: '' }), 2000)
                  }
                }} 
                style={[styles.submitButton, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              >
                <ThemedText style={[styles.submitButtonText, { color: Brand.colors.semantic.danger }]}>{language === 'it' ? 'Elimina' : 'Delete'}</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
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
    height: 400,
    zIndex: 0,
  },
  backgroundGlass: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.8,
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
    color: Brand.colors.text.tertiary,
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
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.colors.primary.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.primary.cyan,
  },
  // Main Balance Card
  balanceCardContainer: {
    marginBottom: 24,
  },
  balanceCard: {
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
    backgroundColor: Brand.colors.background.card,
    minHeight: 160,
  },
  balanceCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: Brand.colors.background.card,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    opacity: 0.15,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
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
    backgroundColor: Brand.colors.primary.cyan,
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
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
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
    backgroundColor: UI_CONSTANTS.SUCCESS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.SUCCESS_BORDER,
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
    color: Brand.colors.semantic.success,
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
    borderColor: Brand.colors.glass.heavy,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    minHeight: 120,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    overflow: 'hidden',
  },
  overviewCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.19,
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
    borderColor: Brand.colors.glass.heavy,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  recentCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 60,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderRightColor: 'rgba(255,255,255,0.06)',
    borderLeftColor: 'rgba(255,255,255,0.06)',
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
  recentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#ef4444',
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
  fabRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
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
    flex: 1,
    maxWidth: 140,
  },
  fabExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  fabIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
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
  addModalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 20,
    backgroundColor: Brand.colors.background.card,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
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
    opacity: 0.15,
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryColumn: {
    flex: 1,
    maxWidth: '48%',
    gap: 5,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderColor: 'rgba(6,182,212,0.35)',
  },
  categoryChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
    paddingHorizontal: 5,
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
  // Modal styles (from expenses tab)
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
    backgroundColor: Brand.colors.background.card,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    color: Brand.colors.text.secondary,
    fontWeight: '600',
  },
  transactionInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  transactionInfoMerchant: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 8,
  },
  transactionAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionInfoAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  transactionInfoNote: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    lineHeight: 20,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    width: '31%',
    marginBottom: 12,
  },
  categoryOptionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  categoryOptionGradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  categoryOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryOptionIconText: {
    fontSize: 20,
  },
  categoryOptionName: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    textAlign: 'center',
  },
});