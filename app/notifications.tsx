import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import {
    checkNotificationPermission,
    isXiaomiDevice,
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
import { useEffect, useState } from 'react'
import { Button, DeviceEventEmitter, FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'

type FilterType = 'all' | 'wallet' | 'other'

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<StoredNotification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<StoredNotification[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [permission, setPermission] = useState<NotificationPermissionStatus>('unknown')
  const [logs, setLogs] = useState<string[]>([])
  const [isXiaomi, setIsXiaomi] = useState(false)
  const [loading, setLoading] = useState(false)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
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
    
    // Check device
    const xiaomi = isXiaomiDevice()
    setIsXiaomi(xiaomi)
    if (xiaomi) {
      addLog('📱 Xiaomi/MIUI device detected')
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

  const renderPermissionCard = () => (
    <Card>
      <ThemedText type="defaultSemiBold">🔐 Stato Permessi</ThemedText>
      <View style={{ gap: 8, marginTop: 8 }}>
        <ThemedText>
          Permesso notifiche: {
            permission === 'authorized' ? '✅ Abilitato' :
            permission === 'denied' ? '❌ Negato' :
            '⚠️  Sconosciuto'
          }
        </ThemedText>
        
        {permission !== 'authorized' && (
          <>
            <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>
              Per ricevere notifiche, devi abilitare l'accesso alle notifiche nelle impostazioni.
            </ThemedText>
            <Button 
              title="📱 Richiedi Permesso" 
              onPress={handleRequestPermission}
            />
          </>
        )}
        
        <Button 
          title="⚙️  Apri Impostazioni Sistema" 
          onPress={handleOpenSettings}
        />
      </View>
    </Card>
  )

  const renderXiaomiGuide = () => {
    if (!isXiaomi) return null
    
    return (
      <Card style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107', borderWidth: 1 }}>
        <ThemedText type="defaultSemiBold" style={{ color: '#856404' }}>
          ⚠️  Dispositivo Xiaomi/MIUI Rilevato
        </ThemedText>
        <ThemedText style={{ color: '#856404', marginTop: 8, fontSize: 13 }}>
          MIUI ha restrizioni aggiuntive. Segui questi passaggi:
        </ThemedText>
        <View style={{ gap: 4, marginTop: 8 }}>
          <ThemedText style={{ color: '#856404', fontSize: 12 }}>
            1️⃣ Impostazioni → App → finora → Auto-avvio → Abilita
          </ThemedText>
          <ThemedText style={{ color: '#856404', fontSize: 12 }}>
            2️⃣ Impostazioni → App → finora → Batteria → Nessuna limitazione
          </ThemedText>
          <ThemedText style={{ color: '#856404', fontSize: 12 }}>
            3️⃣ Impostazioni → App speciali → Accesso notifiche → finora → Abilita
          </ThemedText>
          <ThemedText style={{ color: '#856404', fontSize: 12 }}>
            4️⃣ Riavvia l'app dopo aver configurato
          </ThemedText>
        </View>
      </Card>
    )
  }

  const renderDebugCard = () => (
    <Card>
      <ThemedText type="defaultSemiBold">🐛 Debug</ThemedText>
      <View style={{ gap: 8, marginTop: 8 }}>
        <ThemedText style={{ fontSize: 12 }}>Platform: {Platform.OS}</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          Device: {isXiaomi ? 'Xiaomi/MIUI' : 'Other'}
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          Library: react-native-android-notification-listener
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          Headless Task: ✅ Registered
        </ThemedText>
        
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <Button title="🧪 Test Notifica" onPress={handleTestNotification} />
          <Button title="🔄 Ricarica Notifiche" onPress={loadNotificationsFromStorage} />
          <Button title="🗑️  Pulisci Log" onPress={handleClearLogs} />
          <Button title="🗑️  Pulisci Notifiche" onPress={handleClearNotifications} />
        </View>
      </View>
    </Card>
  )

  const renderLogsCard = () => (
    <Card>
      <ThemedText type="defaultSemiBold">📝 Log Runtime ({logs.length})</ThemedText>
      <ScrollView style={{ maxHeight: 200, marginTop: 8 }}>
        {logs.length === 0 ? (
          <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>Nessun log disponibile</ThemedText>
        ) : (
          logs.map((log, index) => (
            <ThemedText key={index} style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.8 }}>
              {log}
            </ThemedText>
          ))
        )}
      </ScrollView>
    </Card>
  )

  const renderFilterCard = () => (
    <Card>
      <ThemedText type="defaultSemiBold">🔍 Filtri</ThemedText>
      <View style={{ gap: 8, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pressable
            style={[
              styles.filterButton,
              filter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => handleFilterChange('all')}
          >
            <ThemedText style={[
              styles.filterButtonText,
              filter === 'all' && styles.filterButtonTextActive
            ]}>
              Tutte ({notifications.length})
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              filter === 'wallet' && styles.filterButtonActive
            ]}
            onPress={() => handleFilterChange('wallet')}
          >
            <ThemedText style={[
              styles.filterButtonText,
              filter === 'wallet' && styles.filterButtonTextActive
            ]}>
              Wallet ({getWalletNotifications(notifications).length})
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.filterButton,
              filter === 'other' && styles.filterButtonActive
            ]}
            onPress={() => handleFilterChange('other')}
          >
            <ThemedText style={[
              styles.filterButtonText,
              filter === 'other' && styles.filterButtonTextActive
            ]}>
              Altre ({notifications.filter(n => !n.isWalletNotification).length})
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Card>
  )

  const renderInfoCard = () => (
    <Card>
      <ThemedText type="defaultSemiBold">ℹ️  Informazioni</ThemedText>
      <View style={{ gap: 4, marginTop: 8 }}>
        <ThemedText style={{ fontSize: 12 }}>
          ✅ Il servizio headless è registrato e funzionante
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          ✅ Riceve notifiche anche con app chiusa
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          ✅ Salva TUTTE le notifiche in memoria per la visualizzazione
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          ✅ Filtra automaticamente Google Wallet per le spese
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          📝 Usa i filtri per vedere notifiche specifiche
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          🧪 Usa "Test Notifica" per verificare il funzionamento
        </ThemedText>
      </View>
    </Card>
  )

  return (
    <FlatList
      data={filteredNotifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <ThemedText type="title">📬 Notifiche</ThemedText>
          
          {renderPermissionCard()}
          {renderXiaomiGuide()}
          {renderFilterCard()}
          {renderDebugCard()}
          {renderLogsCard()}
          {renderInfoCard()}
          
          <ThemedText type="subtitle" style={{ marginTop: 8 }}>
            Notifiche Ricevute ({filteredNotifications.length})
          </ThemedText>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center' }}>
            {filter === 'all' 
              ? 'Nessuna notifica ricevuta ancora'
              : filter === 'wallet'
              ? 'Nessuna notifica di Google Wallet ricevuta'
              : 'Nessuna altra notifica ricevuta'
            }
          </ThemedText>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', fontSize: 12, marginTop: 4 }}>
            {filter === 'all' 
              ? 'Prova a inviare una notifica di test'
              : 'Prova a cambiare filtro o inviare una notifica di test'
            }
          </ThemedText>
        </Card>
      }
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
              {item.title}
            </ThemedText>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText style={{ fontSize: 10, opacity: 0.5 }}>
                {new Date(item.receivedAt).toLocaleTimeString()}
              </ThemedText>
              {item.isWalletNotification && (
                <ThemedText style={{ fontSize: 9, opacity: 0.6, color: '#10b981' }}>
                  💳 Wallet
                </ThemedText>
              )}
            </View>
          </View>
          <ThemedText style={{ opacity: 0.8 }}>{item.text}</ThemedText>
          <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>
            📱 {item.app}
          </ThemedText>
        </Card>
      )}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
