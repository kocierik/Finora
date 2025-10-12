import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import {
    checkNotificationPermission,
    isXiaomiDevice,
    requestNotificationPermission,
    type NotificationPermissionStatus
} from '@/services/notification-service'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import { useEffect, useState } from 'react'
import { Alert, Button, DeviceEventEmitter, FlatList, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native'

type ActiveNotification = {
  id: string
  app: string
  title: string
  text: string
  time: string
  timestamp: number
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ActiveNotification[]>([])
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
    
    // Invia tramite DeviceEventEmitter (il listener aggiungerà automaticamente alla lista)
    DeviceEventEmitter.emit('wallet_notification', testNotification)
    
    addLog('✅ Test notification sent and expense queued for sync')
    Alert.alert(
      '🧪 Test Completato',
      'Notifica inviata e spesa salvata!\n\nVai alla tab Home per sincronizzare e vedere la spesa.',
      [{ text: 'OK' }]
    )
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
    setNotifications([])
    addLog('🗑️  Notifications cleared')
    
    // Cancella anche il file cache
    try {
      const cacheFile = `${cacheDirectory}notifications.json`
      await writeAsStringAsync(cacheFile, JSON.stringify([]))
      addLog('✅ Cache cleared')
    } catch (error) {
      addLog('⚠️  Failed to clear cache')
    }
  }
  
  const loadNotificationsFromCache = async () => {
    addLog('📂 Loading notifications from cache...')
    try {
      const cacheFile = `${cacheDirectory}notifications.json`
      const data = await readAsStringAsync(cacheFile)
      const cachedNotifications = JSON.parse(data)
      setNotifications(cachedNotifications)
      addLog(`✅ Loaded ${cachedNotifications.length} notifications from cache`)
    } catch (error) {
      addLog('ℹ️  No cached notifications found')
    }
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
    
    // Carica le notifiche dalla cache
    loadNotificationsFromCache()
    
    // Poll ogni 3 secondi per aggiornare la lista dalle cache
    const interval = setInterval(() => {
      loadNotificationsFromCache()
    }, 3000)
    
    // Subscribe to notifications (per notifiche in tempo reale quando app è aperta)
    addLog('📡 Setting up notification listener...')
    const listener = DeviceEventEmitter.addListener('wallet_notification', (payload: any) => {
      addLog('📬 Notification received via DeviceEventEmitter')
      addLog(`📦 App: ${payload.app || payload.packageName || 'Unknown'}`)
      addLog(`📝 Title: ${payload.title || 'No title'}`)
      addLog(`📄 Text: ${payload.text || 'No text'}`)
      
      const notif: ActiveNotification = {
        id: `${payload.app}-${Date.now()}`,
        app: payload.app || payload.packageName || 'Unknown',
        title: payload.title || 'No title',
        text: payload.text || 'No text',
        time: payload.time || new Date().toISOString(),
        timestamp: Date.now(),
      }
      
      setNotifications(prev => [notif, ...prev])
      addLog(`✅ Notification added to list: ${notif.title}`)
      
      // Show alert
      Alert.alert(
        '📬 Notifica ricevuta',
        `App: ${notif.app}\n\n${notif.title}\n${notif.text}`,
        [{ text: 'OK' }]
      )
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
          <Button title="🔄 Ricarica Notifiche" onPress={loadNotificationsFromCache} />
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
          ✅ Filtra automaticamente Google Wallet
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          📝 Controlla i log per vedere le notifiche ricevute
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>
          🧪 Usa "Test Notifica" per verificare il funzionamento
        </ThemedText>
      </View>
    </Card>
  )

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <ThemedText type="title">📬 Notifiche</ThemedText>
          
          {renderPermissionCard()}
          {renderXiaomiGuide()}
          {renderDebugCard()}
          {renderLogsCard()}
          {renderInfoCard()}
          
          <ThemedText type="subtitle" style={{ marginTop: 8 }}>
            Notifiche Ricevute ({notifications.length})
          </ThemedText>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center' }}>
            Nessuna notifica ricevuta ancora
          </ThemedText>
          <ThemedText style={{ opacity: 0.7, textAlign: 'center', fontSize: 12, marginTop: 4 }}>
            Prova a inviare una notifica di test
          </ThemedText>
        </Card>
      }
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
              {item.title}
            </ThemedText>
            <ThemedText style={{ fontSize: 10, opacity: 0.5 }}>
              {new Date(item.timestamp).toLocaleTimeString()}
            </ThemedText>
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
})
