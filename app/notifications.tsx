import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { UI as UI_CONSTANTS } from '@/constants/branding'
import { useSettings } from '@/context/SettingsContext'
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
} from '@/services/notification-storage'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { DeviceEventEmitter, FlatList, Linking, Platform, Pressable, StyleSheet, View } from 'react-native'

type FilterType = 'all' | 'wallet' | 'other'

export default function NotificationsScreen() {
  const { t, locale, language } = useSettings()
  const [notifications, setNotifications] = useState<StoredNotification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<StoredNotification[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [permission, setPermission] = useState<NotificationPermissionStatus>('unknown')
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  // Mostra solo le 5 più recenti in questa schermata

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const logEntry = `[${timestamp}] ${message}`
    console.log(logEntry)
    setLogs(prev => [logEntry, ...prev].slice(0, 100))
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
      notifications = notifications.slice(0, 100) // Mantieni solo le ultime 100
      
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
            lightColor: '#06b6d4'
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
    } catch (e) {
      addLog('❌ Failed to schedule local notification: ' + e)
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
            lightColor: '#06b6d4',
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
    
    // Poll ogni 3 secondi per aggiornare la lista dallo storage
    const interval = setInterval(() => {
      loadNotificationsFromStorage()
    }, 3000)
    
    // Subscribe to notifications (per notifiche in tempo reale quando app è aperta)
    addLog('📡 Setting up notification listener...')
    const listener = DeviceEventEmitter.addListener('wallet_notification', (payload: any) => {
      addLog('📬 Notification received via DeviceEventEmitter')
      addLog(`📦 App: ${payload.app || payload.packageName || 'Unknown'}`)
      addLog(`📝 Title: ${payload.title || 'No title'}`)
      addLog(`📄 Text: ${payload.text || 'No text'}`)
      
      // Ricarica le notifiche dallo storage per mostrare la nuova notifica
      loadNotificationsFromStorage()
    })
    
    addLog('✅ Notification listener registered')
    
    return () => {
      addLog('🛑 Cleaning up notification listener...')
      clearInterval(interval)
      listener.remove()
      addLog('✅ Notification listener cleaned up')
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

  const renderFilterCard = () => null

  const renderInfoCard = () => null

  const displayedNotifications = filteredNotifications.slice(0, 100)

  return (
    <FlatList
      data={displayedNotifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={true}
      style={{ flex: 1 }}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
              <ThemedText style={styles.backIcon}>←</ThemedText>
            </Pressable>
            <ThemedText type="title" style={styles.headerTitle}>{t('notifications')}</ThemedText>
            <View style={{ width: 36 }} />
          </View>
          
          {renderInstructionWarning()}
          
          <ThemedText type="subtitle" style={{ marginTop: 8, marginBottom: 12 }}>{t('recent_notifications')}</ThemedText>
          <Pressable 
            style={styles.primaryButton}
            onPress={handleSendLocalTest}
          >
            <ThemedText style={styles.primaryButtonText}>🔔 {t('try_send_test')}</ThemedText>
          </Pressable>
          
          {/* Bottone di test aggiuntivo per debug */}
          <Pressable 
            style={[styles.primaryButton, { marginTop: 8, backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}
            onPress={handleTestNotification}
          >
            <ThemedText style={styles.primaryButtonText}>🧪 Test Wallet Notification</ThemedText>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center' }}>{t('no_notifications_yet')}</ThemedText>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', fontSize: 12, marginTop: 4 }}>{t('try_send_test')}</ThemedText>
        </Card>
      }
      renderItem={({ item }) => (
        <Pressable style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
        android_ripple={{ color: UI_CONSTANTS.ACCENT_CYAN_BG }}
        >
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
      )}
      ListFooterComponent={null}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
    backgroundColor: '#0a0a0f',
    paddingTop: 40,
    paddingBottom: 20,
  },
  card: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    shadowColor: '#000',
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 4,
    marginBottom: 16,
  },
  cardPressed: {
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06b6d4'
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
    color: '#E8EEF8'
    
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
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  filterButtonTextActive: {
    color: '#10b981',
  },
})
