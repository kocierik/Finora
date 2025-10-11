import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
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
  
  if (!notification) {
    console.log('[HEADLESS] ❌ No notification data received')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return
  }

  try {
    // Parse the notification object properly
    const notifData = typeof notification === 'string' ? JSON.parse(notification) : notification
    
    console.log('[HEADLESS] 📱 NOTIFICATION RECEIVED FROM ANY APP:')
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
                   category: 'other',
                 }
          
          console.log('[HEADLESS] 💰 Parsed expense:', JSON.stringify(expenseData))
          console.log('[HEADLESS] 💾 Saving expense to cache for later sync...')
          
          // Salva la spesa in un file cache per sincronizzarla quando l'app si apre
          const expensesFile = `${cacheDirectory}pending_expenses.json`
          let pendingExpenses = []
          
          try {
            const existingData = await readAsStringAsync(expensesFile)
            pendingExpenses = JSON.parse(existingData)
          } catch (readError) {
            console.log('[HEADLESS] No pending expenses file, creating new one')
          }
          
          pendingExpenses.push({
            ...expenseData,
            timestamp: Date.now(),
            synced: false,
          })
          
          await writeAsStringAsync(expensesFile, JSON.stringify(pendingExpenses))
          console.log('[HEADLESS] ✅ Expense saved to pending queue')
        } else {
          console.log('[HEADLESS] ⚠️  Could not parse amount from notification text')
        }
      } catch (parseError) {
        console.log('[HEADLESS] ❌ Error parsing expense:', parseError.message)
      }
    } else {
      console.log('[HEADLESS] ℹ️  Not a Google Wallet notification (app: ' + appPackage + '), skipping save')
      console.log('[HEADLESS] ℹ️  But this notification was successfully captured!')
    }
    
    // Salva la notifica in un file persistente per visualizzarla nell'app
    console.log('[HEADLESS] 💾 Saving notification to cache...')
    try {
      const notificationData = {
        id: `${notifData.app}-${Date.now()}`,
        app: notifData.app,
        packageName: notifData.app,
        title: notifData.title || 'No title',
        text: notifData.text || notifData.bigText || 'No text',
        time: notifData.time || new Date().toISOString(),
        timestamp: Date.now(),
        isWallet: isWallet,
      }
      
      const cacheFile = `${cacheDirectory}notifications.json`
      
      // Leggi le notifiche esistenti
      let notifications = []
      try {
        const existingData = await readAsStringAsync(cacheFile)
        notifications = JSON.parse(existingData)
      } catch (readError) {
        console.log('[HEADLESS] No existing notifications file, creating new one')
      }
      
      // Aggiungi la nuova notifica
      notifications.unshift(notificationData)
      
      // Mantieni solo le ultime 50 notifiche
      notifications = notifications.slice(0, 50)
      
      // Salva il file
      await writeAsStringAsync(cacheFile, JSON.stringify(notifications))
      console.log('[HEADLESS] ✅ Notification saved to cache')
      
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
    
    console.log('[HEADLESS] ✅ Processing completed')
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



