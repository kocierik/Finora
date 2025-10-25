import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Notifications from 'expo-notifications'
import { AppRegistry, DeviceEventEmitter } from 'react-native'
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener'

/**
 * Headless task per ricevere notifiche in background
 * Questo viene eseguito anche quando l'app è chiusa
 */
const headlessNotificationListener = async ({ notification }) => {
  const timestamp = new Date().toISOString()
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`[HEADLESS] ${timestamp}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Invia log al logger dell'app
  DeviceEventEmitter.emit('headless_log', {
    level: 'INFO',
    message: 'Headless task started',
    source: 'HeadlessTask',
    timestamp: Date.now(),
    data: { timestamp }
  })
  
  if (!notification) {
    console.log('[HEADLESS] ❌ No notification data received')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    DeviceEventEmitter.emit('headless_log', {
      level: 'WARN',
      message: 'No notification data received',
      source: 'HeadlessTask',
      timestamp: Date.now()
    })
    return
  }

  try {
    // Parse the notification object properly
    const notifData = typeof notification === 'string' ? JSON.parse(notification) : notification
    
    console.log('[HEADLESS] 📱 NOTIFICATION RECEIVED:')
    console.log('[HEADLESS] ├─ App Package:', notifData.app || 'N/A')
    console.log('[HEADLESS] ├─ Title:', notifData.title || 'N/A')
    console.log('[HEADLESS] ├─ Text:', notifData.text || 'N/A')
    console.log('[HEADLESS] ├─ Time:', notifData.time || 'N/A')
    console.log('[HEADLESS] ├─ TitleBig:', notifData.titleBig || 'N/A')
    console.log('[HEADLESS] ├─ SubText:', notifData.subText || 'N/A')
    console.log('[HEADLESS] ├─ BigText:', notifData.bigText || 'N/A')
    
    // Log full notification object for debugging
    console.log('[HEADLESS] 📦 Full notification object:')
    console.log(JSON.stringify(notifData, null, 2))
    
    // Check if it's Google Wallet
    const appPackage = notifData.app || ''
    const isWallet = appPackage.includes('wallet') || 
                     appPackage.includes('com.google.android.apps.wallet')
    
    if (isWallet) {
      console.log('[HEADLESS] 🎯 GOOGLE WALLET NOTIFICATION DETECTED!')
      
      DeviceEventEmitter.emit('headless_log', {
        level: 'INFO',
        message: 'Google Wallet notification detected',
        source: 'HeadlessTask',
        timestamp: Date.now(),
        data: { app: appPackage, title: notifData.title }
      })
      
      // Parse la spesa dalla notifica
      try {
        const title = notifData.title || ''
        const text = notifData.text || notifData.bigText || ''
        console.log('[HEADLESS] 📝 Parsing expense from notification...')
        console.log('[HEADLESS]    Title: ' + title)
        console.log('[HEADLESS]    Text: ' + text)
        
        // Estrai importo (formato: "7,00 €")
        const amountMatch = text.match(/([\d.,]+)\s*([€$£])/i)
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(',', '.'))
          const currency = amountMatch[2]
          
          // Estrai merchant dal title (es: "AKATHOR" o "AKATHOR: dettagli")
          let merchant = title
          if (title.includes(':')) {
            merchant = title.split(':')[0].trim()
          }
          
                 const expenseData = {
                   amount,
                   currency,
                   merchant,
                   date: new Date().toISOString().split('T')[0],
                   raw_notification: text,
                   // category_id will be resolved during sync
                 }
          
          console.log('[HEADLESS] 💰 Parsed expense:', JSON.stringify(expenseData))
          
          DeviceEventEmitter.emit('headless_log', {
            level: 'INFO',
            message: 'Expense parsed successfully',
            source: 'HeadlessTask',
            timestamp: Date.now(),
            data: expenseData
          })
          
          // Salva la spesa in un file cache per sincronizzarla quando l'app si apre
          const expensesFile = `${cacheDirectory}pending_expenses.json`
          let pendingExpenses = []
          
          try {
            const existingData = await readAsStringAsync(expensesFile)
            pendingExpenses = JSON.parse(existingData)
          } catch (readError) {
            console.log('[HEADLESS] No pending expenses file, creating new one')
          }
          
          // Controlla duplicati: stessa spesa negli ultimi 30 secondi
          const thirtySecondsAgo = Date.now() - 30 * 1000
          const isDuplicate = pendingExpenses.some(exp => 
            exp.amount === amount && 
            exp.merchant === merchant && 
            exp.date === expenseData.date &&
            exp.timestamp > thirtySecondsAgo
          )
          
          if (isDuplicate) {
            console.log('[HEADLESS] ⚠️  Duplicate expense detected, skipping save')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'WARN',
              message: 'Duplicate expense detected, skipping save',
              source: 'HeadlessTask',
              timestamp: Date.now(),
              data: expenseData
            })
            return
          }
          
          console.log('[HEADLESS] 💾 Saving expense to cache for later sync...')
          
          pendingExpenses.push({
            ...expenseData,
            timestamp: Date.now(),
            synced: false,
          })
          
          await writeAsStringAsync(expensesFile, JSON.stringify(pendingExpenses))
          console.log('[HEADLESS] ✅ Expense saved to pending queue')
          
          DeviceEventEmitter.emit('headless_log', {
            level: 'INFO',
            message: 'Expense saved to pending queue',
            source: 'HeadlessTask',
            timestamp: Date.now(),
            data: { amount: expenseData.amount, merchant: expenseData.merchant }
          })
          
          // Invia notifica di promemoria per impostare la categoria
          try {
            console.log('[HEADLESS] 🔔 Sending category reminder notification...')
            
            // Configura il canale Android per notifiche di promemoria
            await Notifications.setNotificationChannelAsync('category_reminder', {
              name: 'Promemoria Categoria',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#06b6d4',
              enableVibrate: true,
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
              sound: 'default',
            })
            
            // Invia la notifica di promemoria (normale, non interattiva nel headless)
            // Le notifiche interattive verranno gestite quando l'app è aperta
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '💰 Nuovo Pagamento Rilevato',
                body: `Ricordati di impostare la categoria per ${merchant} - ${amount}${currency}`,
                subtitle: 'Finora',
                data: {
                  type: 'category_reminder',
                  expenseId: `pending-${Date.now()}`,
                  merchant: merchant,
                  amount: amount,
                  currency: currency
                },
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.HIGH
              },
              trigger: null // Invia immediatamente
            })
            
            console.log('[HEADLESS] ✅ Category reminder notification sent')
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'INFO',
              message: 'Category reminder notification sent',
              source: 'HeadlessTask',
              timestamp: Date.now(),
              data: { merchant: merchant, amount: amount }
            })
          } catch (notificationError) {
            console.log('[HEADLESS] ⚠️  Failed to send category reminder notification:', notificationError.message)
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'WARN',
              message: 'Failed to send category reminder notification',
              source: 'HeadlessTask',
              timestamp: Date.now(),
              data: { error: notificationError.message }
            })
          }
        } else {
          console.log('[HEADLESS] ⚠️  Could not parse amount from notification text')
          
          DeviceEventEmitter.emit('headless_log', {
            level: 'WARN',
            message: 'Could not parse amount from notification text',
            source: 'HeadlessTask',
            timestamp: Date.now(),
            data: { text: notifData.text }
          })
        }
      } catch (parseError) {
        console.log('[HEADLESS] ❌ Error parsing expense:', parseError.message)
        
        DeviceEventEmitter.emit('headless_log', {
          level: 'ERROR',
          message: 'Error parsing expense',
          source: 'HeadlessTask',
          timestamp: Date.now(),
          data: { error: parseError.message, text: notifData.text }
        })
      }
      
      // Salva SOLO le notifiche di Google Wallet in memoria per la visualizzazione
      console.log('[HEADLESS] 💾 Saving Google Wallet notification to memory storage...')
      try {
        const notificationData = {
          id: `${notifData.app}-${Date.now()}`,
          app: notifData.app,
          packageName: notifData.app,
          title: notifData.title || 'No title',
          text: notifData.text || notifData.bigText || 'No text',
          time: notifData.time || new Date().toISOString(),
          timestamp: Date.now(),
          receivedAt: Date.now(),
          isWalletNotification: true,
        }
        
        const cacheFile = `${cacheDirectory}all_notifications.json`
        
        // Leggi le notifiche esistenti
        let notifications = []
        try {
          const existingData = await readAsStringAsync(cacheFile)
          notifications = JSON.parse(existingData)
        } catch (readError) {
          console.log('[HEADLESS] No existing notifications file, creating new one')
        }
        
        // Aggiungi la nuova notifica all'inizio
        notifications.unshift(notificationData)
        
        // Mantieni solo le ultime 500 notifiche
        notifications = notifications.slice(0, 500)
        
        // Salva il file
        await writeAsStringAsync(cacheFile, JSON.stringify(notifications))
        console.log('[HEADLESS] ✅ Google Wallet notification saved to memory storage:', notificationData.title)
        
        // Prova anche a inviare via DeviceEventEmitter (potrebbe funzionare se l'app è aperta)
        try {
          DeviceEventEmitter.emit('wallet_notification', notificationData)
          console.log('[HEADLESS] ✅ Notification sent via DeviceEventEmitter')
        } catch (emitError) {
          console.log('[HEADLESS] ⚠️  DeviceEventEmitter not available (app might be closed)')
        }
      } catch (saveError) {
        console.log('[HEADLESS] ❌ Failed to save notification:', saveError.message)
      }
    } else {
      console.log('[HEADLESS] ℹ️  Not a Google Wallet notification (app: ' + appPackage + ')')
      console.log('[HEADLESS] ℹ️  Skipping expense parsing and database save')
      console.log('[HEADLESS] ℹ️  Notification was captured but not processed')
      
      DeviceEventEmitter.emit('headless_log', {
        level: 'DEBUG',
        message: 'Non-Wallet notification received',
        source: 'HeadlessTask',
        timestamp: Date.now(),
        data: { app: appPackage, title: notifData.title }
      })
    }
    
    console.log('[HEADLESS] ✅ Processing completed - ' + (isWallet ? 'Google Wallet notification processed and saved' : 'Non-wallet notification ignored (not saved)'))
  } catch (error) {
    console.log('[HEADLESS] ❌ ERROR:', error.message)
    console.log('[HEADLESS] Stack:', error.stack)
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

// Registra il headless task
console.log('[HEADLESS] 🚀 Registering headless task...')
console.log('[HEADLESS] Task name:', RNAndroidNotificationListenerHeadlessJsName)
AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => headlessNotificationListener
)
console.log('[HEADLESS] ✅ Headless task registered successfully\n')



