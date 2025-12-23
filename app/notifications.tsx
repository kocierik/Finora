import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { sendBulkCategoryReminder, sendCategoryReminder, sendInteractiveCategoryReminder, sendWeeklyBulkCategoryReminder } from '@/services/category-reminder'
import { sendDeepLinkCategoryNotification } from '@/services/deep-link-notifications'
import {
    checkNotificationPermission,
    requestNotificationPermission,
    type NotificationPermissionStatus
} from '@/services/notification-service'
import {
    clearNotifications,
    getWalletNotifications,
    loadNotifications,
    sortNotificationsByDate,
    type StoredNotification
} from '@/services/notifications/storage'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DeviceEventEmitter, FlatList, Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

type FilterType = 'all' | 'wallet' | 'other'

// Componente memoizzato per l'item della notifica
const NotificationItem = React.memo(({ item, t, locale }: { 
  item: StoredNotification, 
  t: (key: string) => string, 
  locale: string 
}) => (
  <Pressable style={({ pressed }) => [
    styles.card,
    pressed && styles.cardPressed,
  ]}
  android_ripple={{ color: UI_CONSTANTS.ACCENT_CYAN_BG }}
  >
    <LinearGradient
      colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardGradient}
      pointerEvents="none"
    />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        <View style={styles.accentDot} />
        <ThemedText type="defaultSemiBold" style={styles.titleText}>
          {item.title || t('no_title')}
        </ThemedText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
      <ThemedText style={styles.timeText}>
          {new Date(item.receivedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
        {item.isWalletNotification && (
          <ThemedText style={styles.metaWallet}>💳 {t('wallet_badge')}</ThemedText>
        )}
      </View>
    </View>
      <ThemedText style={styles.messageText}>{item.text || t('no_text')}</ThemedText>
      <ThemedText style={styles.metaText}>📱 {item.app}</ThemedText>
  </Pressable>
))

export default function NotificationsScreen() {
  const { user } = useAuth()
  const { t, locale, language } = useSettings()
  const [notifications, setNotifications] = useState<StoredNotification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<StoredNotification[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [permission, setPermission] = useState<NotificationPermissionStatus>('unknown')
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false) // Stato per mostrare tutte o solo le prime 10
  const INITIAL_NOTIFICATIONS_LIMIT = 10 // Limite iniziale di notifiche da mostrare
  const notificationsUpdatedEvent = 'notifications:updated'

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const logEntry = `[${timestamp}] ${message}`
    setLogs(prev => [logEntry, ...prev].slice(0, 500))
  }

  const checkPermission = async () => {
    addLog('🔍 Checking notification permission...')
    const status = await checkNotificationPermission()
    setPermission(status)
    addLog(`✅ Permission status: ${status}`)
  }

  const handleRequestPermission = async () => {
    addLog('📱 Requesting notification permission...')
    await requestNotificationPermission()
    await checkPermission()
  }

  const handleTestNotification = async () => {
    addLog('🧪 Sending test notification...')
    
    // Usa il formato reale di Google Wallet
    const testNotification = {
      app: 'com.google.android.apps.walletnfcrel',
      packageName: 'com.google.android.apps.walletnfcrel',
      title: 'TEST MERCHANT',
      text: '12,50 € con Mastercard **1234',
      time: new Date().toISOString(),
      timestamp: Date.now(),
    }
    
    // Salva la spesa in cache (simula il headless task)
    try {
      const expenseData = {
        amount: 12.50,
        currency: '€',
        merchant: 'TEST MERCHANT',
        date: new Date().toISOString().split('T')[0],
        raw_notification: testNotification.text,
        category: 'other',
        timestamp: Date.now(),
        synced: false,
      }
      
      const expensesFile = `${cacheDirectory}pending_expenses.json`
      let pendingExpenses = []
      
      try {
        const existingData = await readAsStringAsync(expensesFile)
        pendingExpenses = JSON.parse(existingData)
      } catch (readError) {
        addLog('📂 Creating new pending expenses file')
      }
      
      pendingExpenses.push(expenseData)
      await writeAsStringAsync(expensesFile, JSON.stringify(pendingExpenses))
      
      addLog('💾 Test expense saved to pending queue')
      addLog(`💰 Amount: ${expenseData.amount}${expenseData.currency} at ${expenseData.merchant}`)
    } catch (error) {
      addLog('❌ Failed to save test expense: ' + error)
    }
    
    // Salva direttamente la notifica in memoria per il test
    try {
      const testStoredNotification = {
        id: `test-${Date.now()}`,
        app: testNotification.app,
        title: testNotification.title,
        text: testNotification.text,
        time: testNotification.time,
        timestamp: testNotification.timestamp,
        receivedAt: Date.now(),
        isWalletNotification: true,
      }
      
      const cacheFile = `${cacheDirectory}all_notifications.json`
      let notifications = []
      
      try {
        const existingData = await readAsStringAsync(cacheFile)
        notifications = JSON.parse(existingData)
      } catch (readError) {
        addLog('📂 Creating new notifications file for test')
      }
      
      notifications.unshift(testStoredNotification)
      notifications = notifications.slice(0, 500) // Mantieni solo le ultime 500
      
      await writeAsStringAsync(cacheFile, JSON.stringify(notifications))
      addLog('💾 Test notification saved directly to memory')
      
      // Ricarica le notifiche per mostrare il test
      loadNotificationsFromStorage()
    } catch (error) {
      addLog('❌ Failed to save test notification: ' + error)
    }
    
    // Invia anche tramite DeviceEventEmitter per simulare il flusso normale
    DeviceEventEmitter.emit('wallet_notification', testNotification)
    
    addLog('✅ Test notification sent and saved to memory')
  }

  const handleOpenSettings = () => {
    addLog('⚙️  Opening system settings...')
    Linking.openSettings()
  }

  const handleSendLocalTest = async () => {
    addLog('🧪 Sending local test notification via Expo Notifications...')
    try {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: Brand.colors.primary.cyan
          })
        } catch {}
      }
      try {
        const { status } = await Notifications.getPermissionsAsync()
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync()
        }
      } catch {}

      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('test_notif_title'),
          body: t('test_notif_body'),
          subtitle: 'Finora',
        },
        trigger: null
      })
      addLog('✅ Local test notification scheduled')
      
      // Salva anche la notifica di test nella memoria per visualizzarla
      try {
        const testNotification = {
          id: `finora-test-${Date.now()}`,
          app: 'Finora',
          packageName: 'Finora',
          title: t('test_notif_title'),
          text: t('test_notif_body'),
          time: new Date().toISOString(),
          timestamp: Date.now(),
          receivedAt: Date.now(),
          isWalletNotification: false, // È una notifica di test, non di wallet
        }
        
        const cacheFile = `${cacheDirectory}all_notifications.json`
        let notifications = []
        
        try {
          const existingData = await readAsStringAsync(cacheFile)
          notifications = JSON.parse(existingData)
        } catch (readError) {
          addLog('📂 Creating new notifications file for test')
        }
        
        notifications.unshift(testNotification)
        notifications = notifications.slice(0, 500) // Mantieni solo le ultime 500
        
        await writeAsStringAsync(cacheFile, JSON.stringify(notifications))
        addLog('💾 Test notification saved to memory storage')
        
        // Ricarica le notifiche per mostrare il test
        loadNotificationsFromStorage()
      } catch (saveError) {
        addLog('❌ Failed to save test notification: ' + saveError)
      }
    } catch (e) {
      addLog('❌ Failed to schedule local notification: ' + e)
    }
  }

  const handleTestCategoryReminder = async () => {
    addLog('🧪 Testing category reminder notification...')
    try {
      await sendCategoryReminder({
        merchant: 'TEST MERCHANT',
        amount: 12.50,
        currency: '€',
        expenseId: 'test-123'
      })
      addLog('✅ Category reminder test notification sent')
    } catch (error) {
      addLog('❌ Failed to send category reminder test: ' + error)
    }
  }

  const handleTestBulkReminder = async () => {
    addLog('🧪 Testing bulk category reminder notification...')
    try {
      await sendBulkCategoryReminder(3)
      addLog('✅ Bulk category reminder test notification sent')
    } catch (error) {
      addLog('❌ Failed to send bulk category reminder test: ' + error)
    }
  }

  const handleTestWeeklyBulkReminder = async () => {
    addLog('🧪 Testing weekly bulk category reminder notification...')
    try {
      await sendWeeklyBulkCategoryReminder(5)
      addLog('✅ Weekly bulk category reminder test notification sent')
    } catch (error) {
      addLog('❌ Failed to send weekly bulk category reminder test: ' + error)
    }
  }

  const handleTestInteractiveReminder = async () => {
    addLog('🧪 Testing interactive category reminder notification...')
    try {
      // Usa l'utente reale se disponibile, altrimenti un UUID di test
      const testUserId = user?.id || '00000000-0000-0000-0000-000000000000'
      await sendInteractiveCategoryReminder({
        merchant: 'TEST MERCHANT',
        amount: 15.99,
        currency: '€',
        expenseId: 'test-interactive-123'
      }, testUserId)
      addLog('✅ Interactive category reminder test notification sent')
    } catch (error) {
      addLog('❌ Failed to send interactive category reminder test: ' + error)
    }
  }

  const handleTestDeepLinkReminder = async () => {
    addLog('🧪 Testing deep link category reminder notification...')
    try {
      await sendDeepLinkCategoryNotification(
        'test-deeplink-123',
        'TEST MERCHANT',
        25.50,
        '€'
      )
      addLog('✅ Deep link category reminder test notification sent')
    } catch (error) {
      addLog('❌ Failed to send deep link category reminder test: ' + error)
    }
  }

  const handleClearLogs = () => {
    setLogs([])
    addLog('🗑️  Logs cleared')
  }

  const handleClearNotifications = async () => {
    await clearNotifications()
    setNotifications([])
    setFilteredNotifications([])
    addLog('🗑️  All notifications cleared')
  }
  
  const loadNotificationsFromStorage = async () => {
    addLog('📂 Loading notifications from storage...')
    try {
      const storedNotifications = await loadNotifications()
      const sortedNotifications = sortNotificationsByDate(storedNotifications)
      setNotifications(sortedNotifications)
      addLog(`✅ Loaded ${sortedNotifications.length} notifications from storage`)
      
      // Applica il filtro corrente
      applyFilter(sortedNotifications, filter)
    } catch (error) {
      addLog('ℹ️  No stored notifications found')
    }
  }

  const applyFilter = (notificationsToFilter: StoredNotification[], filterType: FilterType) => {
    let filtered: StoredNotification[] = []
    
    switch (filterType) {
      case 'wallet':
        filtered = getWalletNotifications(notificationsToFilter)
        break
      case 'other':
        filtered = notificationsToFilter.filter(n => !n.isWalletNotification)
        break
      case 'all':
      default:
        filtered = notificationsToFilter
        break
    }
    
    setFilteredNotifications(filtered)
    addLog(`🔍 Filtered to ${filtered.length} notifications (${filterType})`)
  }

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    setShowAll(false) // Reset al cambiare filtro per mostrare di nuovo solo le prime 10
    applyFilter(notifications, newFilter)
  }

  useEffect(() => {
    addLog('🚀 Notifications screen mounted')
    
    // Ensure local notifications show as heads-up while app is foreground
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        })
      })
    } catch {}

    // Ensure high-importance Android channel exists for heads-up notifications
    if (Platform.OS === 'android') {
      (async () => {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: Brand.colors.primary.cyan,
            enableVibrate: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          })
        } catch {}
      })()
    }

    // Check permission
    checkPermission()
    
    // Carica le notifiche dallo storage
    loadNotificationsFromStorage()
    
    // Subscribe to storage updates (evento unico, niente polling)
    const storageListener = DeviceEventEmitter.addListener(notificationsUpdatedEvent, () => {
      addLog('📂 notifications:updated → reload')
      loadNotificationsFromStorage()
    })

    // Subscribe to real-time emitter (quando app è aperta)
    addLog('📡 Setting up notification listener...')
    const listener = DeviceEventEmitter.addListener('wallet_notification', (payload: any) => {
      addLog('📬 Notification received via DeviceEventEmitter')
      addLog(`📦 App: ${payload.app || payload.packageName || 'Unknown'}`)
      addLog(`📝 Title: ${payload.title || 'No title'}`)
      addLog(`📄 Text: ${payload.text || 'No text'}`)
      
      loadNotificationsFromStorage()
    })
    
    addLog('✅ Notification listeners registered')
    
    return () => {
      addLog('🛑 Cleaning up notification listeners...')
      storageListener.remove()
      listener.remove()
      addLog('✅ Notification listeners cleaned up')
    }
  }, [])

  const renderInstructionWarning = () => (
    <Card>
      <ThemedText type="defaultSemiBold">⚠️ {t('important_instructions_title')}</ThemedText>
      <View style={{ gap: 8, marginTop: 8 }}>
        <ThemedText style={{ opacity: 0.85, fontSize: 13 }}>{t('important_instructions_intro')}</ThemedText>
        <View style={{ gap: 4 }}>
          <ThemedText style={{ fontSize: 12 }}>{t('important_instructions_point1')}</ThemedText>
          <ThemedText style={{ fontSize: 12 }}>{t('important_instructions_point2')}</ThemedText>
          <ThemedText style={{ fontSize: 12 }}>{t('important_instructions_point3')}</ThemedText>
        </View>
        <ThemedText style={{ opacity: 0.85, fontSize: 13 }}>{t('important_instructions_hint')}</ThemedText>
        <Pressable 
          style={styles.primaryButton}
          onPress={handleOpenSettings}
        >
          <ThemedText style={styles.primaryButtonText}>⚙️ {t('open_settings')}</ThemedText>
        </Pressable>
      </View>
    </Card>
  )

  const renderXiaomiGuide = () => null

  const renderDebugCard = () => null

  const renderLogsCard = () => null

  const renderFilterCard = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 8, marginTop: 4 }}>
      <Pressable
        style={[
          styles.filterButton,
          filter === 'all' && styles.filterButtonActive,
        ]}
        onPress={() => handleFilterChange('all')}
      >
        <ThemedText
          style={[
            styles.filterButtonText,
            filter === 'all' && styles.filterButtonTextActive,
          ]}
        >
          {t('all')}
        </ThemedText>
      </Pressable>
      <Pressable
        style={[
          styles.filterButton,
          filter === 'wallet' && styles.filterButtonActive,
        ]}
        onPress={() => handleFilterChange('wallet')}
      >
        <ThemedText
          style={[
            styles.filterButtonText,
            filter === 'wallet' && styles.filterButtonTextActive,
          ]}
        >
          {t('wallet_badge')}
        </ThemedText>
      </Pressable>
      <Pressable
        style={[
          styles.filterButton,
          filter === 'other' && styles.filterButtonActive,
        ]}
        onPress={() => handleFilterChange('other')}
      >
        <ThemedText
          style={[
            styles.filterButtonText,
            filter === 'other' && styles.filterButtonTextActive,
          ]}
        >
          {language === 'it' ? 'Altro' : 'Other'}
        </ThemedText>
      </Pressable>
    </View>
  )

  const renderInfoCard = () => null

  // Mostra solo le prime 10 notifiche inizialmente, tutte se showAll è true
  const displayedNotifications = useMemo(() => {
    if (showAll) {
      return filteredNotifications
    }
    return filteredNotifications.slice(0, INITIAL_NOTIFICATIONS_LIMIT)
  }, [filteredNotifications, showAll])
  
  // Calcola quante notifiche rimangono da mostrare
  const remainingCount = useMemo(() => {
    return Math.max(0, filteredNotifications.length - INITIAL_NOTIFICATIONS_LIMIT)
  }, [filteredNotifications.length])

  // Funzione memoizzata per il renderItem
  const renderItem = useCallback(({ item }: { item: StoredNotification }) => (
    <NotificationItem item={item} t={t} locale={locale} />
  ), [t, locale])

  // Funzione memoizzata per keyExtractor
  const keyExtractor = useCallback((item: StoredNotification) => item.id, [])

  // Funzione memoizzata per getItemLayout (opzionale, per performance migliori)
  const getItemLayout = useCallback((data: ArrayLike<StoredNotification> | null | undefined, index: number) => ({
    length: 100, // Altezza approssimativa di ogni item
    offset: 100 * index,
    index,
  }), [])

  return (
    <FlatList
      data={displayedNotifications}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={true}
      style={{ flex: 1 }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ThemedText style={styles.backIcon}>←</ThemedText>
            </Pressable>
            <ThemedText type="title" style={styles.headerTitle}>{t('notifications')}</ThemedText>
            <View style={{ width: 36 }} />
          </View>
          
          {renderFilterCard()}
          
          {renderInstructionWarning()}
          
          <ThemedText type="subtitle" style={{ marginTop: 8, marginBottom: 12 }}>{t('recent_notifications')}</ThemedText>
          <Pressable 
            style={styles.primaryButton}
            onPress={handleSendLocalTest}
          >
            <ThemedText style={styles.primaryButtonText}>🔔 {t('try_send_test')}</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8 }]}
            onPress={loadNotificationsFromStorage}
          >
            <ThemedText style={styles.primaryButtonText}>🔄 {language === 'it' ? 'Ricarica notifiche' : 'Reload notifications'}</ThemedText>
          </Pressable>
          
          {/* Bottone di test aggiuntivo per debug */}
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}
            onPress={handleTestNotification}
          >
            <ThemedText style={styles.primaryButtonText}>🧪 Test Wallet Notification</ThemedText>
          </Pressable>
          
          {/* Bottoni di test per notifiche di promemoria categoria */}
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}
            onPress={handleTestCategoryReminder}
          >
            <ThemedText style={styles.primaryButtonText}>💳 Test Category Reminder</ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.35)' }]}
            onPress={handleTestBulkReminder}
          >
            <ThemedText style={styles.primaryButtonText}>📋 Test Bulk Reminder</ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' }]}
            onPress={handleTestWeeklyBulkReminder}
          >
            <ThemedText style={styles.primaryButtonText}>📅 Test Weekly Reminder</ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.35)' }]}
            onPress={handleTestInteractiveReminder}
          >
            <ThemedText style={styles.primaryButtonText}>⚡ Test Interactive Reminder</ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}
            onPress={handleTestDeepLinkReminder}
          >
            <ThemedText style={styles.primaryButtonText}>🔗 Test Deep Link Reminder</ThemedText>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center' }}>{t('no_notifications_yet')}</ThemedText>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', fontSize: 12, marginTop: 4 }}>{t('try_send_test')}</ThemedText>
        </Card>
      }
      ListFooterComponent={
        !showAll && remainingCount > 0 ? (
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <Pressable 
              style={styles.showMoreButton}
              onPress={() => setShowAll(true)}
            >
              <ThemedText style={styles.showMoreButtonText}>
                Mostra altri {remainingCount} {remainingCount === 1 ? 'messaggio' : 'messaggi'}
              </ThemedText>
            </Pressable>
          </View>
        ) : null
      }
    />
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
    backgroundColor: Brand.colors.background.deep,
    paddingTop: 40,
    paddingBottom: 20,
  },
  card: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    shadowColor: 'transparent',
    borderColor: Brand.colors.glass.heavy,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.colors.primary.cyan
  },
  titleText: {
    flex: 1
  },
  messageText: {
    opacity: 0.9
  },
  metaText: {
    fontSize: 11,
    opacity: 0.6
  },
  timeText: {
    fontSize: 10,
    opacity: 0.55
  },
  metaWallet: {
    fontSize: 9,
    opacity: 0.7,
    color: UI_CONSTANTS.SUCCESS_TEXT
  },
  // unified glassmorphic primary button
  primaryButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER
  },
  primaryButtonText: {
    fontWeight: '700',
    color: Brand.colors.text.primary
    
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 56,
  },
  backButton: {
    width: 44,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER
  },
  backIcon: {
    fontSize: 20,
    marginBottom: 8,
    opacity: 0.9
  },
  headerTitle: {
    textAlign: 'center',
    flex: 1
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
  },
  filterButtonActive: {
    backgroundColor: UI_CONSTANTS.SUCCESS_BG,
    borderColor: UI_CONSTANTS.SUCCESS_BORDER,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.colors.text.secondary,
  },
  filterButtonTextActive: {
    color: Brand.colors.semantic.success,
  },
  showMoreButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
  },
  showMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.primary.cyan, // Brand.colors.primary.cyan
    textAlign: 'center',
  },
})
