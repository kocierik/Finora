import { ExpensesPie } from '@/components/charts/ExpensesPie'
import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

export default function ExpensesScreen() {
  const { user, loading } = useAuth()
  const [items, setItems] = useState<Expense[]>([])
  const [hideBalances, setHideBalances] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Expense | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [autoAssignedCount, setAutoAssignedCount] = useState(0)
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current
  const balanceAnim = useRef(new Animated.Value(0)).current
  const listAnim = useRef(new Animated.Value(0)).current

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

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setRefreshing(true)
    try {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50) // Get more recent transactions
      
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

  useEffect(() => {
    fetchExpenses()
    
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

    return () => clearInterval(interval)
  }, [fetchExpenses])


  // Focus effect to reload data when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchExpenses()
    }, [fetchExpenses])
  )

  // KPIs
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  const prevMonthDate = new Date(curYear, curMonth - 1, 1)
  const prevMonth = prevMonthDate.getMonth()
  const prevYear = prevMonthDate.getFullYear()
  const monthTotal = items.filter((e) => sameMonth(e.date, curYear, curMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const prevTotal = items.filter((e) => sameMonth(e.date, prevYear, prevMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const delta = monthTotal - prevTotal
  const deltaPct = prevTotal > 0 ? (delta / prevTotal) * 100 : 0

  const monthName = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  // Debug log for month calculation
  console.log('Month calculation:', {
    curYear,
    curMonth,
    monthName,
    now: now.toISOString(),
    monthTotal,
    prevTotal,
    totalItems: items.length
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

  // Available categories for selection (same as spending categories)
  const availableCategories = categories

  // Calculate category spending from real data - use useMemo to make it reactive
  const categoryTotals = useMemo(() => {
    console.log('Recalculating categoryTotals with items:', items.length)
    
    // Debug: show all items with their categories
    const currentMonthItems = items.filter(e => sameMonth(e.date, curYear, curMonth))
    console.log('Current month items:', currentMonthItems.length)
    console.log('All current month items:', currentMonthItems.map(e => ({ 
      merchant: e.merchant, 
      category: e.category, 
      amount: e.amount, 
      date: e.date 
    })))
    
    return categories.map(cat => {
      const categoryItems = items.filter(e => 
        sameMonth(e.date, curYear, curMonth) && 
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
        allItems: items.length,
        monthTotal,
        sampleItems: categoryItems.slice(0, 2).map(e => ({ merchant: e.merchant, category: e.category, amount: e.amount }))
      })
      
      return { ...cat, amount, percentage }
    }).sort((a, b) => b.amount - a.amount)
  }, [items, curYear, curMonth, monthTotal])

  const onRefresh = useCallback(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const handleTransactionPress = useCallback((transaction: Expense) => {
    setSelectedTransaction(transaction)
    setShowCategoryModal(true)
  }, [])

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
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <ThemedText style={styles.headerTitle}>Spese</ThemedText>
              <ThemedText style={styles.headerSubtitle}>{monthName}</ThemedText>
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
            </View>
          </View>
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
            <Card style={styles.autoAssignCard} glow="rgba(16, 185, 129, 0.2)">
              <View style={styles.autoAssignContent}>
                <ThemedText style={styles.autoAssignIcon}>✨</ThemedText>
                <ThemedText style={styles.autoAssignText}>
                  Assegnate automaticamente {autoAssignedCount} categorie
                </ThemedText>
              </View>
            </Card>
          </Animated.View>
        )}

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
            onPressIn={() => Animated.spring(scaleAnim1, { toValue: 0.97, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()}
          >
            <Card style={styles.balanceCard} glow="rgba(239, 68, 68, 0.2)">
              <LinearGradient
                colors={['rgba(239, 68, 68, 0.12)', 'rgba(220, 38, 38, 0.06)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              />
              <View style={styles.balanceIconContainer}>
                <View style={styles.balanceIcon}>
                  <ThemedText style={styles.balanceIconText}>💳</ThemedText>
                </View>
                <View style={styles.neonLine} />
              </View>
              <View style={styles.balanceContent}>
                <ThemedText style={styles.balanceLabel}>Totale questo mese</ThemedText>
                <Animated.View style={{ 
                  transform: [{ 
                    scale: balanceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.05]
                    })
                  }] 
                }}>
                  <ThemedText style={styles.balanceValue}>
                    {hideBalances ? '€ •••••' : `€ ${monthTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </ThemedText>
                </Animated.View>
                <View style={styles.balanceFooter}>
                  <View style={[styles.balanceBadge, { 
                backgroundColor: delta >= 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                borderColor: delta >= 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
              }]}>
                    <ThemedText style={[styles.balanceBadgeText, { color: delta >= 0 ? '#ef4444' : '#10b981' }]}>
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </ThemedText>
              </View>
                  <ThemedText style={styles.balanceSubtext}>
                    vs mese precedente
              </ThemedText>
                </View>
            </View>
          </Card>
          </Pressable>
        </Animated.View>

          {/* Secondary KPIs */}
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
              colors={deltaPct >= 0 ? ['rgba(239, 68, 68, 0.1)', 'rgba(220, 38, 38, 0.05)'] : ['rgba(16, 185, 129, 0.1)', 'rgba(20, 184, 166, 0.05)']}
              style={styles.kpiGradient}
            >
              <View style={styles.kpiIcon}>
                <ThemedText style={styles.kpiIconText}>{deltaPct >= 0 ? '📈' : '📉'}</ThemedText>
              </View>
              <ThemedText style={styles.kpiLabel}>Variazione</ThemedText>
              <ThemedText style={[styles.kpiValue, { color: deltaPct >= 0 ? '#ef4444' : '#10b981' }]}>
                {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
              </ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.kpiCard}>
            <LinearGradient
              colors={['rgba(6, 182, 212, 0.1)', 'rgba(20, 184, 166, 0.05)']}
              style={styles.kpiGradient}
            >
              <View style={styles.kpiIcon}>
                <ThemedText style={styles.kpiIconText}>🧾</ThemedText>
              </View>
              <ThemedText style={styles.kpiLabel}>Transazioni</ThemedText>
              <ThemedText style={styles.kpiValue}>
                {items.filter((e) => sameMonth(e.date, curYear, curMonth)).length}
              </ThemedText>
            </LinearGradient>
          </Pressable>
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
            <ThemedText style={styles.sectionTitle}>Categorie di spesa</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>Distribuzione mensile</ThemedText>
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
                    Animated.spring(scaleAnim1, { toValue: 0.95, useNativeDriver: true }).start()
                  }}
                  onPressOut={() => {
                    Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()
                  }}
                >
                  <LinearGradient
                    colors={[`${category.color}15`, `${category.color}08`]}
                    style={styles.categoryGradient}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                      <ThemedText style={styles.categoryIconText}>{category.icon}</ThemedText>
                    </View>
                    <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                    <ThemedText style={styles.categoryAmount}>
                      € {category.amount.toFixed(0)}
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
                  </LinearGradient>
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
          <Card style={styles.chartCard} glow="rgba(139, 92, 246, 0.1)">
            <View style={styles.chartHeader}>
              <View style={styles.chartIcon}>
                <ThemedText style={styles.chartIconText}>📊</ThemedText>
              </View>
              <ThemedText style={styles.chartTitle}>Distribuzione per categoria</ThemedText>
            </View>
            <View style={styles.chartContainer}>
              <ExpensesPie items={items} />
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
              <ThemedText style={styles.sectionTitle}>Transazioni recenti</ThemedText>
              <Pressable 
                style={styles.refreshButton}
                onPress={fetchExpenses}
                disabled={refreshing}
              >
                <ThemedText style={styles.refreshButtonText}>
                  {refreshing ? '🔄' : '↻'}
                </ThemedText>
              </Pressable>
          </View>
            <ThemedText style={styles.sectionSubtitle}>
              {items.length} transazioni • Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </View>
          
          {items.length > 0 ? (
            <View style={styles.transactionsList}>
              {items.slice(0, 15).map((item, index) => (
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
                    <Card style={styles.transactionCard}>
                      <View style={styles.transactionContent}>
                        <View style={styles.transactionLeft}>
                          <View style={styles.transactionIcon}>
                            <ThemedText style={styles.transactionIconText}>💳</ThemedText>
                          </View>
                          <View style={styles.transactionText}>
                            <View style={styles.transactionTitleRow}>
                              <ThemedText style={styles.transactionMerchant}>
                                {item.merchant ?? '—'}
                              </ThemedText>
                            </View>
                            <View style={styles.transactionDateRow}>
                              <ThemedText style={styles.transactionDate}>
                                {formatDate(item.date)}
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
                                
                                // Always show badge if categoryInfo exists
                                return categoryInfo ? (
                                  <View style={[
                                    styles.categoryBadge, 
                                    { 
                                      backgroundColor: `${categoryInfo.color}20`,
                                      borderColor: isAutoAssigned || isDefaultOther ? `${categoryInfo.color}40` : 'transparent',
                                      borderWidth: isAutoAssigned || isDefaultOther ? 1 : 0,
                                    }
                                  ]}>
                                    <ThemedText style={[styles.categoryBadgeText, { color: categoryInfo.color }]}>
                                      {categoryInfo.icon} {categoryInfo.name}
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
                          <ThemedText style={styles.transactionAmount}>
              € {item.amount?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ) : (
        <Card style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>Nessuna spesa registrata</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Le spese da Google Wallet verranno aggiunte automaticamente
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
            <Card style={styles.modalCard} glow="rgba(6, 182, 212, 0.2)">
              <LinearGradient
                colors={['rgba(6, 182, 212, 0.12)', 'rgba(20, 184, 166, 0.06)', 'transparent']}
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
                <ThemedText style={styles.transactionInfoAmount}>
                  € {selectedTransaction?.amount?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
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
    </View>
  )
}

function formatDate(dateStr: string) {
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
    const diffTime = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffTime / (1000 * 60))
    
    // Show relative time for recent transactions
    if (diffMinutes < 60) {
      return diffMinutes < 1 ? 'Ora' : `${diffMinutes}m fa`
    } else if (diffHours < 24) {
      return `${diffHours}h fa`
    } else if (diffDays === 1) {
      return 'Ieri'
    } else if (diffDays < 7) {
      return `${diffDays} giorni fa`
    } else {
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
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
    height: 220,
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
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
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
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    marginBottom: 4,
  },
  transactionMerchant: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 2,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transactionDate: {
    fontSize: 13,
    color: '#06b6d4',
    fontWeight: '600',
  },
  transactionRight: {
    alignItems: 'flex-end',
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
  modalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  modalScrollView: {
    maxHeight: 300,
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
  transactionInfoAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#06b6d4',
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
  categoryOptionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  categoryOptionGradient: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  categoryOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryOptionIconText: {
    fontSize: 20,
  },
  categoryOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    textAlign: 'center',
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


