import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import { loadExpenseThresholds, saveExpenseThresholds, type ExpenseThresholds } from '@/services/expense-thresholds'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, DeviceEventEmitter, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'

export default function ProfileScreen() {
  const { user, signOut, loading: authLoading } = useAuth()
  const { language, locale, currency, enableBiometrics, sessionTimeoutMinutes, setLanguage, setLocale, setCurrency, setEnableBiometrics, setSessionTimeoutMinutes, monthlyBudget, setMonthlyBudget, t, categories, setCategories } = useSettings()
  const [displayName, setDisplayName] = useState('')
  const [currentDisplayName, setCurrentDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [expenseThresholds, setExpenseThresholds] = useState<ExpenseThresholds>({ moderate: 1000, high: 1500 })
  const [thresholdsLoading, setThresholdsLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const [editableCategories, setEditableCategories] = useState(categories)
  const [dbCategories, setDbCategories] = useState<Array<{ id: string; name: string; icon: string; color: string; sort_order: number }>>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editEmoji, setEditEmoji] = useState('')
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const colorPalette = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#EC4899', '#8B5CF6']
  const emojiSuggestions = ['📦','🚗','🛒','🛍️','🌃','✈️','🏥','📚','⚡','🎬']
  const firstGrapheme = (text: string) => (Array.from(text || '')[0] || '')
  const normalizeEmoji = (text: string) => {
    const base = firstGrapheme(text)
    const stripped = base
      .replace(/\uFE0F/g, '')
      .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
      .replace(/\u200D/g, '')
    const one = firstGrapheme(stripped)
    return one || ''
  }

  // Function to show tutorial again
  const showTutorial = async () => {
    try {
      // Set force onboarding flag to show tutorial
      await AsyncStorage.setItem('@finora:forceOnboarding', '1')
      await AsyncStorage.setItem('@finora:onboardingActive', '1')
      // Navigate to onboarding
      router.push('/onboarding')
    } catch (error) {
      console.log('[Profile] Error showing tutorial:', error)
      Alert.alert('Errore', 'Impossibile aprire il tutorial')
    }
  }

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current
  const scaleAnim3 = useRef(new Animated.Value(0.95)).current

  // Note: Avoid early returns before hooks; render guards applied just before JSX return

  // Default categories for new users
  const DEFAULT_CATEGORIES = [
    { name: 'Food & Drinks', icon: '🍽️', color: '#F59E0B', sort_order: 0 },
    { name: 'Transport', icon: '🚗', color: '#10B981', sort_order: 1 },
    { name: 'Home & Utilities', icon: '🏠', color: '#3B82F6', sort_order: 2 },
    { name: 'Entertainment', icon: '🎬', color: '#EF4444', sort_order: 3 },
    { name: 'Health & Personal', icon: '🏥', color: '#EC4899', sort_order: 4 },
    { name: 'Miscellaneous', icon: '📦', color: '#8B5CF6', sort_order: 5 }
  ]

  // Load categories from database
  const loadCategoriesFromDb = async () => {
    if (!user) return
    
    setCategoriesLoading(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
      
      if (error) {
        console.error('Error loading categories:', error)
        return
      }
      
      // If no categories exist, create default ones
      if (!data || data.length === 0) {
        console.log('[Profile] 📊 No categories found, creating default categories...')
        const { data: newCategories, error: createError } = await supabase
          .from('categories')
          .insert(DEFAULT_CATEGORIES.map(cat => ({
            ...cat,
            user_id: user.id
          })))
          .select()
        
        if (createError) {
          console.error('Error creating default categories:', createError)
          return
        }
        
        setDbCategories(newCategories || [])
        
        // Convert to editable format
        const editable = (newCategories || []).map(cat => ({
          key: cat.name.toLowerCase().replace(/\s+/g, '_'),
          name: cat.name,
          icon: cat.icon,
          color: cat.color
        }))
        
        setEditableCategories(editable)
      } else {
        setDbCategories(data)
        
        // Convert to editable format
        const editable = data.map(cat => ({
          key: cat.name.toLowerCase().replace(/\s+/g, '_'),
          name: cat.name,
          icon: cat.icon,
          color: cat.color
        }))
        
        setEditableCategories(editable)
      }
      
      // Reload category counts when categories are updated
      await loadCategoryCounts()
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }

  // Load category counts
  const loadCategoryCounts = async () => {
    if (!user) {
      console.log('[Profile] 📊 No user, skipping category counts')
      return
    }
    
    console.log('[Profile] 📊 Loading category counts for user:', user.id)
    
    try {
      // Query expenses with category_id and join with categories table
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id,
          merchant,
          category_id,
          categories (
            name
          )
        `)
        .eq('user_id', user.id)
      
      console.log('[Profile] 📊 Expenses query result:', { data: expensesData, error: expensesError })
      
      if (expensesError) {
        console.log('[Profile] ⚠️  Error querying expenses:', expensesError)
        return
      }
      
      if (!expensesData || expensesData.length === 0) {
        console.log('[Profile] 📊 No expenses found for user')
        setCategoryCounts({})
        return
      }
      
      const counts: Record<string, number> = {}
      
      console.log('[Profile] 📊 Processing expenses data...')
      expensesData.forEach((expense: any) => {
        // Use categories.name from the join, fallback to 'Other' if no category
        const categoryName = expense.categories?.name || 'Other'
        counts[categoryName] = (counts[categoryName] || 0) + 1
      })
      
      console.log('[Profile] 📊 Final calculated category counts:', counts)
      setCategoryCounts(counts)
    } catch (e) {
      console.log('[Profile] ⚠️  Error loading category counts:', e)
    }
  }

  useEffect(() => {
    ;(async () => {
      if (!user) return
      
      // Carica dati del profilo
      const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      const metaName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || ''
      const identityName = (user as any)?.identities?.[0]?.identity_data?.name || ''
      const fallbackEmailName = (user?.email || '').split('@')[0] || ''
      const derived = (data?.display_name || metaName || identityName || fallbackEmailName || '').trim()
      if (data) {
        const name = data.display_name ?? ''
        setDisplayName(name || derived)
        setCurrentDisplayName(name || derived)
      } else {
        // Se non c'è un profilo, inizializzalo con un nome derivato se disponibile
        if (derived) {
          try {
            await supabase.from('profiles').upsert({ id: user.id, display_name: derived })
          } catch {}
        }
        setDisplayName(derived)
        setCurrentDisplayName(derived)
      }
      
      // Carica soglie delle spese
      try {
        const thresholds = await loadExpenseThresholds(user?.id)
        setExpenseThresholds(thresholds)
      } catch (error) {
        console.log('[Profile] ⚠️  Error loading expense thresholds:', error)
      }
      
      // Load categories from database (this will also load category counts)
      await loadCategoriesFromDb()
    })()

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
      Animated.spring(scaleAnim3, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [user?.id])

  // Keep local editable copy of categories in sync
  useEffect(() => {
    setEditableCategories(categories)
  }, [categories])

  // Listen for external category updates
  useEffect(() => {
    const handleCategoriesUpdate = () => {
      loadCategoriesFromDb()
    }

    DeviceEventEmitter.addListener('settings:categoriesUpdated', handleCategoriesUpdate)
    DeviceEventEmitter.addListener('expenses:externalUpdate', handleCategoriesUpdate)

    return () => {
      DeviceEventEmitter.removeAllListeners('settings:categoriesUpdated')
      DeviceEventEmitter.removeAllListeners('expenses:externalUpdate')
    }
  }, [user])

  const save = async () => {
    if (!user) return
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName })
    setLoading(false)
    if (error) {
      setSuccessMessage(t('error_prefix') + error.message)
      setShowSuccessModal(true)
    } else {
      setCurrentDisplayName(displayName)
      setSuccessMessage(t('profile_updated_success'))
      setShowSuccessModal(true)
    }
  }

  const saveThresholds = async () => {
    try {
      setThresholdsLoading(true)
      await saveExpenseThresholds(expenseThresholds, user?.id)
      setSuccessMessage(t('thresholds_updated_success'))
      setShowSuccessModal(true)
    } catch (error: any) {
      setSuccessMessage(t('error_prefix') + (error.message || t('thresholds_save_error_generic')))
      setShowSuccessModal(true)
    } finally {
      setThresholdsLoading(false)
    }
  }

  const saveCategories = async (override?: typeof editableCategories) => {
    if (!user) return
    
    setCategoriesLoading(true)
    try {
      // Basic validation: limit to 6, ensure name/icon/color present
      const source = override ?? editableCategories
      const sanitized = (source || []).slice(0, 6).map((c, index) => ({
        name: (c.name?.trim() || 'Other').slice(0, UI_CONSTANTS.CATEGORY_MAX_LENGTH),
        icon: normalizeEmoji(c.icon?.trim() || ''),
        color: c.color?.trim() || '#10b981',
        sort_order: index
      }))
      
      // Get current categories to preserve IDs
      const { data: currentCategories } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
      
      const updatedCategories = []
      
      // Update existing categories or create new ones
      for (let i = 0; i < sanitized.length; i++) {
        const newCategory = sanitized[i]
        const existingCategory = currentCategories?.[i]
        
        if (existingCategory) {
          // Update existing category (preserve ID)
          const { error } = await supabase
            .from('categories')
            .update({
              name: newCategory.name,
              icon: newCategory.icon,
              color: newCategory.color,
              sort_order: newCategory.sort_order,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCategory.id)
          
          if (error) {
            console.error('Error updating category:', error)
            throw error
          }
          
          updatedCategories.push({
            id: existingCategory.id,
            ...newCategory
          })
        } else {
          // Create new category
          const { data, error } = await supabase
            .from('categories')
            .insert({
              ...newCategory,
              user_id: user.id
            })
            .select()
            .single()
          
          if (error) {
            console.error('Error creating category:', error)
            throw error
          }
          
          updatedCategories.push(data)
        }
      }
      
      // Delete any extra categories that are no longer needed
      if (currentCategories && currentCategories.length > sanitized.length) {
        const categoriesToDelete = currentCategories.slice(sanitized.length)
        for (const category of categoriesToDelete) {
          await supabase
            .from('categories')
            .delete()
            .eq('id', category.id)
        }
      }
      
      // Update local state
      setDbCategories(updatedCategories)
      
      // Also update the old categories config for backward compatibility
      const legacyFormat = sanitized.map(c => ({
        key: c.name.toLowerCase().replace(/\s+/g, '_'),
        name: c.name,
        icon: c.icon,
        color: c.color,
      }))
      
      setCategories(legacyFormat)
      
      // Persist to profiles table for backward compatibility
      await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          categories_config: legacyFormat, 
          updated_at: new Date().toISOString() 
        })
      
      // Reload category counts after saving
      await loadCategoryCounts()
      
      // Notify other screens to refresh
      DeviceEventEmitter.emit('settings:categoriesUpdated')
      DeviceEventEmitter.emit('expenses:externalUpdate')
      
      setSuccessMessage(language === 'it' ? 'Categorie aggiornate!' : 'Categories updated!')
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error saving categories:', error)
      setSuccessMessage(language === 'it' ? 'Errore nel salvare le categorie!' : 'Error saving categories!')
      setShowSuccessModal(true)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const openEditModal = (index: number) => {
    const cat = editableCategories[index]
    setEditIndex(index)
    setEditEmoji(cat.icon || '📦')
    setEditName(cat.name || '')
    setEditColor(cat.color || '#10b981')
    setEditModalVisible(true)
  }

  const applyEdit = async () => {
    if (editIndex === null) return
    const next = [...editableCategories]
    next[editIndex] = {
      ...next[editIndex],
      icon: normalizeEmoji(editEmoji || ''),
      name: (editName || 'Other').trim().slice(0, UI_CONSTANTS.CATEGORY_MAX_LENGTH),
      color: (editColor || '#10b981').trim(),
    }
    setEditableCategories(next)
    // Persist immediately when pressing Save in modal
    await saveCategories(next)
    setEditModalVisible(false)
  }

  if (authLoading) {
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
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <ThemedText style={styles.userInitial}>
                {currentDisplayName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </ThemedText>
        </View>
            <View style={styles.userDetails}>
              <ThemedText type="heading" style={styles.userName}>
                {currentDisplayName || (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || (user?.email || '').split('@')[0] || 'Utente'}
              </ThemedText>
              <ThemedText type="body" style={styles.userEmail}>
                {user?.email}
              </ThemedText>
        </View>
      </View>
        </View>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* Impostazioni Account */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim1 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
        <View style={styles.cardHeader}>
            <ThemedText type="heading" style={styles.cardTitle}>{t('account_settings')}</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>👤</ThemedText>
        </View>
              <View style={styles.settingContent}>
                <ThemedText type="label" style={styles.settingLabel}>{t('name')}</ThemedText>
            <TextInput 
                  style={styles.settingInput} 
              value={displayName} 
              onChangeText={setDisplayName} 
              placeholder="Il tuo nome"
              placeholderTextColor={Brand.colors.text.muted}
            />
          </View>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>📧</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText type="label" style={styles.settingLabel}>{t('email_address')}</ThemedText>
                <ThemedText type="body" style={styles.settingValue}>{user?.email}</ThemedText>
              </View>
            </View>
          </View>
          <Pressable 
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={save} 
            disabled={loading}
            onPressIn={() => Animated.spring(scaleAnim1, { toValue: 0.95, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()}
          >
            <ThemedText type="label" style={styles.primaryButtonText}>
              {loading ? t('saving_changes') : t('save_changes')}
              </ThemedText>
          </Pressable>
      </Card>
        </Animated.View>

        {/* Impostazioni Finanziarie */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim2 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
        <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('financial_settings')}</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>💰</ThemedText>
        </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>{language === 'it' ? 'Soglia Moderata (€)' : 'Moderate Threshold (€)'}</ThemedText>
                <TextInput 
                  style={styles.settingInput} 
                  value={expenseThresholds.moderate.toString()} 
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0
                    setExpenseThresholds(prev => ({ ...prev, moderate: value }))
                  }} 
                  placeholder="1000"
                  placeholderTextColor={Brand.colors.text.muted}
                  keyboardType="numeric"
                />
                <ThemedText style={styles.settingDescription}>
                  {language === 'it' ? 'Le spese da' : 'Expenses from'} {expenseThresholds.moderate}€ {language === 'it' ? 'a' : 'to'} {expenseThresholds.high}€ {language === 'it' ? 'sono considerate moderate' : 'are considered moderate'}
          </ThemedText>
              </View>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>📈</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>{language === 'it' ? 'Soglia Alta (€)' : 'High Threshold (€)'}</ThemedText>
                <TextInput 
                  style={styles.settingInput} 
                  value={expenseThresholds.high.toString()} 
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0
                    setExpenseThresholds(prev => ({ ...prev, high: value }))
                  }} 
                  placeholder="1500"
                  placeholderTextColor={Brand.colors.text.muted}
                  keyboardType="numeric"
                />
                <ThemedText style={styles.settingDescription}>
                  {language === 'it' ? 'Le spese superiori a' : 'Expenses above'} {expenseThresholds.high}€ {language === 'it' ? 'sono considerate alte' : 'are considered high'}
                </ThemedText>
              </View>
            </View>
          </View>
          <Pressable 
            style={[styles.primaryButton, thresholdsLoading && styles.primaryButtonDisabled]}
            onPress={saveThresholds} 
            disabled={thresholdsLoading}
            onPressIn={() => Animated.spring(scaleAnim2, { toValue: 0.95, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim2, { toValue: 1, useNativeDriver: true }).start()}
          >
            <ThemedText style={styles.primaryButtonText}>
              {thresholdsLoading ? t('saving_changes') : t('save_thresholds')}
            </ThemedText>
          </Pressable>
        </Card>
        </Animated.View>

        {/* Spending Categories */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim2 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
             <View style={styles.cardHeader}>
               <ThemedText style={styles.cardTitle}>{language === 'it' ? 'Categorie di spesa' : 'Spending Categories'}</ThemedText>
               {categoriesLoading && (
                 <ActivityIndicator size="small" color="#06b6d4" style={{ marginLeft: 8 }} />
               )}
             </View>
             <View style={styles.categoryList}>
              {editableCategories.slice(0, 6).map((cat, idx) => {
                const count = categoryCounts[cat.name] || 0
                return (
                  <View 
                    key={idx} 
                    style={[
                      styles.categoryRow,
                      {
                        backgroundColor: cat.color ? `${cat.color}15` : UI_CONSTANTS.GLASS_BG,
                        borderColor: cat.color ? `${cat.color}30` : UI_CONSTANTS.GLASS_BORDER
                      }
                    ]}
                  >
                    <View style={styles.categoryLeft}>
                      <View 
                        style={[
                          styles.categoryEmoji,
                          {
                            backgroundColor: cat.color ? `${cat.color}20` : UI_CONSTANTS.GLASS_BG_MD,
                            borderColor: cat.color ? `${cat.color}40` : UI_CONSTANTS.GLASS_BORDER_MD
                          }
                        ]}
                      >
                        <ThemedText style={{ fontSize: 20 }}>{cat.icon || ''}</ThemedText>
                      </View>
                      <View style={{ gap: 2 }}>
                        <ThemedText 
                          type="defaultSemiBold" 
                          style={[
                            styles.categoryTitle,
                            cat.color && { color: cat.color }
                          ]}
                        >
                          {(cat.name || 'Other').length > UI_CONSTANTS.CATEGORY_MAX_LENGTH ? (cat.name || 'Other').slice(0, UI_CONSTANTS.CATEGORY_MAX_LENGTH) + '…' : (cat.name || 'Other')}
                        </ThemedText>
                        <ThemedText style={styles.categorySubtitle}>{count} {language === 'it' ? 'Spese' : 'Expenses'}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      <View style={[styles.colorDotLarge, { backgroundColor: cat.color || '#10b981' }]} />
                      <TouchableOpacity
                        style={[
                          styles.gearButton,
                          {
                            backgroundColor: cat.color ? `${cat.color}20` : UI_CONSTANTS.GLASS_BG_MD,
                            borderColor: cat.color ? `${cat.color}40` : UI_CONSTANTS.GLASS_BORDER_MD
                          }
                        ]}
                        onPress={() => openEditModal(idx)}
                      >
                        <ThemedText style={styles.gearIcon}>⚙️</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>
        </Animated.View>

        {/* Category Edit Modal */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: UI_CONSTANTS.MODAL_OVERLAY_DARK }]}> 
            <Card style={[styles.modalCard, styles.modalGlass, { backgroundColor: `${(editColor || '#10b981')}22`, borderColor: `${(editColor || '#10b981')}55`, shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 }]}> 
              <View style={styles.modalHeaderRow}>
                <View style={[styles.previewBadge, { borderColor: editColor || '#10b981' }]}>
                  <ThemedText style={styles.previewEmoji}>{editEmoji || ''}</ThemedText>
                </View>
                <View style={styles.previewInfo}>
                  <ThemedText type="heading" style={styles.modalTitleText}>
                    {language === 'it' ? 'Modifica categoria' : 'Edit category'}
                  </ThemedText>
                  <View style={styles.previewColorRow}>
                    <View style={[styles.previewColorDot, { backgroundColor: editColor || '#10b981' }]} />
                    <ThemedText style={styles.previewColorLabel}>{editName || (language === 'it' ? 'Senza nome' : 'Untitled')}</ThemedText>
                  </View>
                </View>
              </View>

              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    style={[styles.settingInput, { flex: 1 }]}
                    value={editEmoji}
                    maxLength={4}
                    onChangeText={(text) => setEditEmoji(normalizeEmoji(text))}
                    placeholder={language === 'it' ? 'Emoji' : 'Emoji'}
                    placeholderTextColor={Brand.colors.text.muted}
                  />
                  <TextInput
                    style={[styles.settingInput, { flex: 3 }]}
                    value={editName}
                    maxLength={UI_CONSTANTS.CATEGORY_MAX_LENGTH}
                    onChangeText={(text) => setEditName((text || '').slice(0, UI_CONSTANTS.CATEGORY_MAX_LENGTH))}
                    placeholder={language === 'it' ? 'Nome' : 'Name'}
                    placeholderTextColor={Brand.colors.text.muted}
                  />
                </View>
                <View style={{ marginTop: 10 }}>
                  <View style={styles.colorRow}>
                    {colorPalette.map((hex) => (
                      <Pressable
                        key={hex}
                        style={[styles.colorDot, { backgroundColor: hex }, editColor === hex && styles.colorDotSelected]}
                        onPress={() => setEditColor(hex)}
                      />
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                  <Pressable style={[styles.modalButtonSecondary]} onPress={() => setEditModalVisible(false)}>
                    <ThemedText style={styles.modalButtonSecondaryText}>{language === 'it' ? 'Annulla' : 'Cancel'}</ThemedText>
                  </Pressable>
                   <Pressable 
                     style={[styles.modalButtonPrimary, categoriesLoading && styles.primaryButtonDisabled]} 
                     onPress={applyEdit}
                     disabled={categoriesLoading}
                   >
                     <ThemedText style={styles.modalButtonPrimaryText}>
                       {categoriesLoading ? (language === 'it' ? 'Salvando...' : 'Saving...') : (language === 'it' ? 'Salva' : 'Save')}
                     </ThemedText>
                   </Pressable>
                </View>
              </View>
            </Card>
          </View>
        </Modal>

        {/* App Actions */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim3 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('app_actions')}</ThemedText>
          </View>
          <View style={styles.actionList}>
            <Pressable 
              style={styles.actionItem}
              onPress={() => router.push('/notifications')}
            >
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>🔔</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>{t('notifications')}</ThemedText>
                <ThemedText style={styles.actionDescription}>{t('notifications_desc')}</ThemedText>
             {/*  <ThemedText style={styles.actionMeta}>{t('last_update')}: {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</ThemedText> */}
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionItem}
              onPress={() => Alert.alert(language === 'it' ? 'Sicurezza' : 'Security', language === 'it' ? 'Gestisci autenticazione, sessioni e permessi (presto disponibile).' : 'Manage authentication, sessions and permissions (coming soon).')}
            >
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>🔐</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>{t('security')}</ThemedText>
                <ThemedText style={styles.actionDescription}>{t('security_desc')}</ThemedText>
              {/*  <ThemedText style={styles.actionMeta}>Account: {user?.email}</ThemedText> */}
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionItem}
              //onPress={() => Alert.alert(language === 'it' ? 'Supporto' : 'Support', language === 'it' ? 'Scrivici a contactfinora@gmail.com o consulta le FAQ (presto disponibile).' : 'Write us at contactfinora@gmail.com or check the FAQ (coming soon).')}
            >
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>ℹ️</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>{t('support')}</ThemedText>
                <ThemedText style={styles.actionDescription}>{t('support_desc')}</ThemedText>
                <ThemedText style={styles.actionMeta}>{t('support_email_label')}: contactfinora@gmail.com</ThemedText>
              </View>
             {/*<ThemedText style={styles.actionArrow}>→</ThemedText>*/}
            </Pressable>
          </View>
        </Card>
        </Animated.View>

        {/* Tutorial */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim3 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t('tutorial')}</ThemedText>
            </View>
            <View style={styles.actionList}>
              <Pressable 
                style={styles.actionItem}
                onPress={showTutorial}
              >
                <View style={styles.actionIcon}>
                  <ThemedText style={styles.actionIconText}>🎯</ThemedText>
                </View>
                <View style={styles.actionContent}>
                  <ThemedText style={styles.actionLabel}>{t('review_tutorial')}</ThemedText>
                  <ThemedText style={styles.actionDescription}>{t('tutorial_desc')}</ThemedText>
                </View>
                <ThemedText style={styles.actionArrow}>→</ThemedText>
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        {/* Lingua e Formati */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim2 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('language_formats')}</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>🌐</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText type="label" style={styles.settingLabel}>{t('language_label')}</ThemedText>
                <View style={styles.langChipsContainer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={language === 'it' ? 'Lingua Italiano selezionata' : 'Seleziona Italiano'}
                    style={[
                      styles.langChip,
                      language === 'it' && styles.langChipActive,
                    ]}
                    onPress={() => { setLanguage('it'); setLocale('it-IT') }}
                  >
                    <ThemedText style={styles.langChipFlag}>🇮🇹</ThemedText>
                    <ThemedText style={[styles.langChipText, language === 'it' && styles.langChipTextActive]}>Italiano</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={language === 'en' ? 'English language selected' : 'Select English'}
                    style={[
                      styles.langChip,
                      language === 'en' && styles.langChipActive,
                    ]}
                    onPress={() => { setLanguage('en'); setLocale('en-US') }}
                  >
                    <ThemedText style={styles.langChipFlag}>🇺🇸</ThemedText>
                    <ThemedText style={[styles.langChipText, language === 'en' && styles.langChipTextActive]}>English</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
          </Card>
        </Animated.View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
      <Pressable 
            style={[styles.logoutButton, loading && styles.logoutButtonDisabled]} 
        onPress={async () => {
          try {
            setLoading(true)
                console.log('[Profile] 🚪 Starting logout process...')
            await signOut()
            console.log('[Profile] ✅ Logout completed, redirecting...')
                setTimeout(() => {
                  console.log('[Profile] 🔄 Redirecting to welcome screen...')
                }, 100)
          } catch (error) {
            console.error('[Profile] ❌ Logout failed:', error)
                Alert.alert('Error', 'Unable to logout. Please try again.')
            setLoading(false)
          }
        }}
        disabled={loading}
      >
        <ThemedText style={styles.logoutButtonText}>
              {loading ? (language === 'it' ? 'Disconnessione...' : 'Signing out...') : (language === 'it' ? 'Esci' : 'Sign Out')}
        </ThemedText>
      </Pressable>
      </View>
    </ScrollView>

      {/* Custom Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: UI_CONSTANTS.MODAL_OVERLAY_DARK }]}> 
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
            <Card  style={styles.modalCard}>
              <View style={styles.modalContent}>
                <View style={styles.modalIcon}>
                  <ThemedText style={styles.modalIconText}>
                    {successMessage.includes('Errore') ? '❌' : '✅'}
                  </ThemedText>
                </View>
                <ThemedText type="heading" style={styles.modalTitle}>
                  {successMessage.includes('Errore') ? (language === 'it' ? 'Errore' : 'Error') : (language === 'it' ? 'Completato' : 'Done')}
                </ThemedText>
                <ThemedText type="body" style={styles.modalMessage}>
                  {successMessage}
                </ThemedText>
                <Pressable 
                  style={styles.modalButton}
                  onPress={() => setShowSuccessModal(false)}
                >
                  <ThemedText type="label" style={styles.modalButtonText}>
                    {language === 'it' ? 'Chiudi' : 'Close'}
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  premiumHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: 'rgba(6, 182, 212, 0.02)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#06b6d4',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  brandHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
    position: 'relative',
  },
  brandGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  appIcon: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 2,
  },
  brandInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  versionBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.colors.primary.cyan,
  },
  premiumCard: {
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    opacity: 0.7,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  valueSmall: {
    fontSize: 12,
    opacity: 0.8,
    fontFamily: 'monospace',
  },
  helpText: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 4,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Brand.colors.glass.light,
    marginVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.colors.glass.medium,
    backgroundColor: Brand.colors.background.elevated,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    fontSize: 15,
    color: Brand.colors.text.primary,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  notificationsContent: {
    gap: 16,
  },
  notificationsDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    color: Brand.colors.text.secondary,
  },
  notificationsButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  notificationsButtonGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  notificationsButtonIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.background.deep,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  colorDotSelected: {
    borderColor: '#ffffff',
    borderWidth: 2,
  },
  categoryList: {
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryEmoji: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD
  },
  categoryTitle: {
    color: Brand.colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  categorySubtitle: {
    color: Brand.colors.text.tertiary,
    fontSize: 12,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD
  },
  gearButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD
  },
  gearIcon: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER
  },
  fabText: {
    color: '#06b6d4',
    fontSize: 28,
    fontWeight: '700'
  },
  aboutContent: {
    gap: 20,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 13,
    opacity: 0.8,
    flex: 1,
  },
  logoutButton: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.colors.semantic.danger,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
  },
  footerCopyright: {
    fontSize: 11,
    opacity: 0.4,
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
  // New premium styles
  settingsList: {
    gap: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconText: {
    fontSize: 18,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 8,
  },
  settingInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Brand.colors.text.primary,
  },
  settingValue: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    marginTop: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: Brand.colors.text.tertiary,
    marginTop: 6,
    lineHeight: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    color: Brand.colors.text.primary,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderColor: 'rgba(6,182,212,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E8EEF8',
  },
  actionList: {
    gap: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(6,182,212,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionIconText: {
    fontSize: 18,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
  },
  actionMeta: {
    fontSize: 12,
    color: Brand.colors.text.tertiary,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 18,
    color: '#06b6d4',
    marginLeft: 8,
  },
  langChipsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    backgroundColor: 'rgba(6,182,212,0.06)',
    gap: 8,
  },
  langChipActive: {
    backgroundColor: 'rgba(6,182,212,0.18)',
    borderColor: 'rgba(6,182,212,0.45)',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  langChipFlag: {
    fontSize: 16,
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8EEF8',
  },
  langChipTextActive: {
    color: '#06b6d4',
    fontWeight: '700',
  },
  logoutSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    padding: 0,
    width: '98%',
    maxWidth: 640,
  },
  modalGlass: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    overflow: 'hidden'
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  previewBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    
  },
  previewEmoji: {
    fontSize: 24,
  },
  previewInfo: {
    flex: 1,
  },
  modalTitleText: {
    color: Brand.colors.text.primary,
  },
  previewColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  previewColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  previewColorLabel: {
    color: Brand.colors.text.secondary,
    fontSize: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalButtonPrimaryText: {
    color: '#0a0a0f',
    fontWeight: '700',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  modalButtonSecondaryText: {
    color: '#E8EEF8',
    fontWeight: '600',
  },
  modalContent: {
    alignItems: 'center',
    padding: 24,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconText: {
    fontSize: 32,
  },
  modalTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
})



