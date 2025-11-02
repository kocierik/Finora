import AsyncStorage from '@react-native-async-storage/async-storage'
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
    
    // Check if it's a monitored bank
    const appPackage = notifData.app || ''
    const appPackageLower = appPackage.toLowerCase()
    
    // Load monitored banks from AsyncStorage
    let monitoredBanks = ['google_wallet'] // Default fallback
    try {
      const stored = await AsyncStorage.getItem('@finora:monitored_banks')
      if (stored) {
        monitoredBanks = JSON.parse(stored)
      }
    } catch (error) {
      console.log('[HEADLESS] ⚠️  Error loading monitored banks, using default (Google Wallet only)')
    }
    
    // Bank configurations for matching
    const bankConfigs = {
      google_wallet: {
        packageNames: ['com.google.android.apps.wallet', 'com.google.android.apps.walletnfcrel'],
        keywords: ['wallet']
      },
      revolut: {
        packageNames: ['com.revolut.revolut'],
        keywords: ['revolut']
      },
      n26: {
        packageNames: ['de.number26.android'],
        keywords: ['n26']
      },
      hype: {
        packageNames: ['it.banca.hype'],
        keywords: ['hype']
      },
      bbva: {
        packageNames: ['com.bbva.bbvacontigo', 'com.bbva.mx.bbvacontigo'],
        keywords: ['bbva']
      },
      intesa_sanpaolo: {
        packageNames: ['com.intesasanpaolo.isp'],
        keywords: ['intesa', 'sanpaolo']
      },
      unicredit: {
        packageNames: ['com.unicreditgroup.mobile'],
        keywords: ['unicredit']
      },
      fineco: {
        packageNames: ['it.fineco.bank'],
        keywords: ['fineco']
      },
      wise: {
        packageNames: ['com.transferwise.android'],
        keywords: ['wise', 'transferwise']
      },
      monzo: {
        packageNames: ['com.getmondo'],
        keywords: ['monzo']
      },
      illimity: {
        packageNames: ['com.illimity.bank'],
        keywords: ['illimity']
      },
      widiba: {
        packageNames: ['com.widiba.mobile'],
        keywords: ['widiba']
      },
      banca_sella: {
        packageNames: ['it.bancasella.mobile'],
        keywords: ['sella']
      },
      banco_bpm: {
        packageNames: ['com.bancobpm.mobile'],
        keywords: ['banco', 'bpm']
      },
      bper: {
        packageNames: ['com.bper.mobile'],
        keywords: ['bper']
      }
    }
    
    // Check if notification matches any monitored bank
    let isMonitoredBank = false
    let matchedBank = null
    
    for (const bankId of monitoredBanks) {
      const config = bankConfigs[bankId]
      if (!config) continue
      
      // Check package names
      for (const packageName of config.packageNames) {
        if (appPackageLower.includes(packageName.toLowerCase())) {
          isMonitoredBank = true
          matchedBank = bankId
          break
        }
      }
      
      if (isMonitoredBank) break
      
      // Check keywords
      for (const keyword of config.keywords) {
        if (appPackageLower.includes(keyword.toLowerCase())) {
          isMonitoredBank = true
          matchedBank = bankId
          break
        }
      }
      
      if (isMonitoredBank) break
    }
    
    if (isMonitoredBank) {
      console.log(`[HEADLESS] 🎯 MONITORED BANK NOTIFICATION DETECTED! (${matchedBank})`)
      
      DeviceEventEmitter.emit('headless_log', {
        level: 'INFO',
        message: `Monitored bank notification detected (${matchedBank})`,
        source: 'HeadlessTask',
        timestamp: Date.now(),
        data: { app: appPackage, title: notifData.title, bank: matchedBank }
      })
      
      // Parse la transazione dalla notifica (spesa o accredito)
      try {
        const title = notifData.title || ''
        const text = notifData.text || notifData.bigText || ''
        const fullText = (title + ' ' + text).toLowerCase()
        
        console.log('[HEADLESS] 📝 Parsing transaction from notification...')
        console.log('[HEADLESS]    Title: ' + title)
        console.log('[HEADLESS]    Text: ' + text)
        
        // Rileva se è un accredito (entrata) o un addebito (spesa)
        const isCredit = /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund|\+[\d.,]+/i.test(fullText)
        const isDebit = /pagamento|acquisto|spesa|addebito|prelievo|bonifico in uscita|trasferimento inviato|pago|pagato|storno/i.test(fullText)
        
        // Se non è chiaro, assume che sia una spesa (default)
        const isIncome = isCredit && !isDebit
        
        // Estrai importo (formato: "7,00 €" o "+7,00 €" o "-7,00 €")
        // Prima prova a matchare con segno esplicito, poi senza
        let amountMatch = text.match(/([+-])?\s*([\d.,]+)\s*([€$£])/i)
        if (!amountMatch) {
          amountMatch = text.match(/([\d.,]+)\s*([€$£])/i)
        }
        
        if (amountMatch) {
          // Gestisce sia "7,00 €" che "+7,00 €" che "-7,00 €"
          let amountStr
          let currency
          
          let sign = null
          
          if (amountMatch.length >= 4) {
            // Pattern con segno: [+-], importo, valuta
            sign = amountMatch[1]
            amountStr = amountMatch[2]
            currency = amountMatch[3]
            
            // Se c'è un segno esplicito, usalo
            if (sign === '-') {
              isIncome = false
            } else if (sign === '+') {
              isIncome = true
            }
          } else {
            // Pattern senza segno: importo, valuta
            amountStr = amountMatch[1]
            currency = amountMatch[2]
          }
          
          let amount = parseFloat(amountStr.replace(',', '.'))
          
          // Applica il segno basandosi sul tipo di transazione
          if (sign === '-') {
            amount = -Math.abs(amount)
          } else if (sign === '+') {
            amount = Math.abs(amount)
          } else {
            // Se non c'è segno esplicito, usa il rilevamento basato sul testo
            amount = isIncome ? Math.abs(amount) : -Math.abs(amount)
          }
          
          // Estrai merchant dal title (es: "AKATHOR" o "AKATHOR: dettagli")
          let merchant = title
          if (title.includes(':')) {
            merchant = title.split(':')[0].trim()
          }
          
          // Se non c'è merchant e sembra un accredito, usa un valore generico
          if (!merchant || merchant === '') {
            merchant = isIncome ? 'Accredito' : 'Pagamento'
          }
          
                 const expenseData = {
                   amount, // Negativo per spese, positivo per entrate
                   currency,
                   merchant,
                   date: new Date().toISOString().split('T')[0],
                   raw_notification: text,
                   // category_id will be resolved during sync
                 }
          
          const transactionType = isIncome ? 'income' : 'expense'
          console.log(`[HEADLESS] 💰 Parsed ${transactionType}:`, JSON.stringify(expenseData))
          
          DeviceEventEmitter.emit('headless_log', {
            level: 'INFO',
            message: `${isIncome ? 'Income' : 'Expense'} parsed successfully`,
            source: 'HeadlessTask',
            timestamp: Date.now(),
            data: { ...expenseData, transaction_type: transactionType }
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
          
          // Controlla duplicati: stessa transazione negli ultimi 30 secondi
          const thirtySecondsAgo = Date.now() - 30 * 1000
          const isDuplicate = pendingExpenses.some(exp => 
            Math.abs(exp.amount) === Math.abs(amount) && 
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
          
          console.log(`[HEADLESS] 💾 Saving ${transactionType} to cache for later sync...`)
          
          pendingExpenses.push({
            ...expenseData,
            timestamp: Date.now(),
            synced: false,
          })
          
          await writeAsStringAsync(expensesFile, JSON.stringify(pendingExpenses))
          console.log('[HEADLESS] ✅ Expense saved to pending queue')
          
          // Emetti evento per sincronizzazione immediata (se l'app è aperta)
          DeviceEventEmitter.emit('expense:saved', {
            amount: expenseData.amount,
            merchant: expenseData.merchant,
            timestamp: Date.now()
          })
          
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
            const notificationTitle = isIncome 
              ? '💰 Nuovo Accredito Rilevato'
              : '💰 Nuovo Pagamento Rilevato'
            const notificationBody = isIncome
              ? `Ricevuto ${Math.abs(amount)}${currency} da ${merchant}`
              : `Ricordati di impostare la categoria per ${merchant} - ${Math.abs(amount)}${currency}`
            
            await Notifications.scheduleNotificationAsync({
              content: {
                title: notificationTitle,
                body: notificationBody,
                subtitle: 'Finora',
                data: {
                  type: 'category_reminder',
                  expenseId: `pending-${Date.now()}`,
                  merchant: merchant,
                  amount: Math.abs(amount),
                  currency: currency,
                  isIncome: isIncome
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
      
          // Salva la notifica della banca monitorata in memoria per la visualizzazione
      console.log(`[HEADLESS] 💾 Saving ${matchedBank} notification to memory storage...`)
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
          isWalletNotification: matchedBank === 'google_wallet', // Mantieni retrocompatibilità
          bankId: matchedBank,
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
        console.log(`[HEADLESS] ✅ ${matchedBank} notification saved to memory storage:`, notificationData.title)
        
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
      console.log('[HEADLESS] ℹ️  Not a monitored bank notification (app: ' + appPackage + ')')
      console.log('[HEADLESS] ℹ️  Skipping expense parsing and database save')
      console.log('[HEADLESS] ℹ️  But saving notification for display')
      
      // Salva anche le notifiche di altre app per la visualizzazione
      console.log('[HEADLESS] 💾 Saving non-Wallet notification to memory storage...')
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
          isWalletNotification: false,
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
        console.log('[HEADLESS] ✅ Non-Wallet notification saved to memory storage:', notificationData.title)
        
        // Prova anche a inviare via DeviceEventEmitter (potrebbe funzionare se l'app è aperta)
        try {
          DeviceEventEmitter.emit('wallet_notification', notificationData)
          console.log('[HEADLESS] ✅ Notification sent via DeviceEventEmitter')
        } catch (emitError) {
          console.log('[HEADLESS] ⚠️  DeviceEventEmitter not available (app might be closed)')
        }
      } catch (saveError) {
        console.log('[HEADLESS] ❌ Failed to save non-Wallet notification:', saveError.message)
      }
      
      DeviceEventEmitter.emit('headless_log', {
        level: 'DEBUG',
        message: 'Non-Wallet notification received and saved',
        source: 'HeadlessTask',
        timestamp: Date.now(),
        data: { app: appPackage, title: notifData.title }
      })
    }
    
    console.log('[HEADLESS] ✅ Processing completed - ' + (isMonitoredBank ? `${matchedBank} notification processed and saved` : 'Non-monitored bank notification saved for display'))
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



