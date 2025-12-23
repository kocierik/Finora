import AsyncStorage from '@react-native-async-storage/async-storage'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import * as Notifications from 'expo-notifications'
import { AppRegistry, DeviceEventEmitter } from 'react-native'
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener'
import { extractAmountAndCurrency, extractMerchant, isPromotionalNotification } from './services/notifications/parser'
import { saveNotificationRecord } from './services/notifications/storage'

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
    
    // Log package name for debugging
    console.log(`[HEADLESS] 🔍 Checking package: "${appPackage}" (lowercase: "${appPackageLower}")`)
    console.log(`[HEADLESS] 🔍 Monitored banks: ${JSON.stringify(monitoredBanks)}`)
    
    // Check if notification matches any monitored bank
    let isMonitoredBank = false
    let matchedBank = null
    
    // First, check for Google Wallet explicitly (always monitor it as fallback)
    const isGoogleWallet = appPackageLower.includes('com.google.android.apps.wallet') ||
                          appPackageLower.includes('com.google.android.apps.walletnfcrel') ||
                          appPackageLower === 'wallet' ||
                          (appPackageLower.includes('wallet') && appPackageLower.includes('google'))
    
    if (isGoogleWallet) {
      isMonitoredBank = true
      matchedBank = 'google_wallet'
      console.log(`[HEADLESS] 🎯 Google Wallet detected via explicit check: ${appPackage}`)
    } else {
      // Check other monitored banks
      for (const bankId of monitoredBanks) {
        const config = bankConfigs[bankId]
        if (!config) continue
        
        // Check package names (exact match or contains)
        for (const packageName of config.packageNames) {
          const packageLower = packageName.toLowerCase()
          // Try exact match first
          if (appPackageLower === packageLower || appPackageLower.includes(packageLower)) {
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
    }
    
    // Fallback: if no match but package contains "wallet", assume it's Google Wallet
    if (!isMonitoredBank && appPackageLower.includes('wallet')) {
      isMonitoredBank = true
      matchedBank = 'google_wallet'
      console.log(`[HEADLESS] 🎯 Google Wallet detected via fallback (package contains "wallet"): ${appPackage}`)
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
        
        console.log('[HEADLESS] 📝 Parsing transaction from notification...')
        console.log('[HEADLESS]    Title: ' + title)
        console.log('[HEADLESS]    Text: ' + text)
        
        // Rileva se è un accredito (entrata) o un addebito (spesa)
        const fullText = (title + ' ' + text).toLowerCase()
        const isCredit = /accredito|ricevuto|entrata|bonifico in entrata|trasferimento ricevuto|deposito|versamento|ricarica ricevuta|stipendio|pensione|rimborso|refund|dividendo|dividend|cedola|interessi|interest|\+[\d.,]+/i.test(
          fullText,
        )
        const isDebit = /pagamento|acquisto|spesa|addebito|prelievo|bonifico in uscita|trasferimento inviato|pago|pagato|storno/i.test(
          fullText,
        )
        
        // Se non è chiaro, assume che sia una spesa (default)
        const isIncome = isCredit && !isDebit
        
        // Filtra offerte promozionali pure con helper condiviso
        if (isPromotionalNotification(title, text)) {
          console.log('[HEADLESS] 🚫 Promotional offer detected, skipping save')
          console.log('[HEADLESS]    Title: ' + title)
          console.log('[HEADLESS]    Text: ' + text)
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
          
          DeviceEventEmitter.emit('headless_log', {
            level: 'INFO',
            message: 'Promotional offer detected, skipping save',
            source: 'HeadlessTask',
            timestamp: Date.now(),
            data: { title, text },
          })
          return
        }

        // Estrai importo con helper condiviso
        const parsedAmount = extractAmountAndCurrency(text)
        if (parsedAmount) {
          let { amount, currency, sign } = parsedAmount

          // Applica il segno basandosi sul tipo di transazione
          if (sign === '-') {
            isIncome = false
            amount = -Math.abs(amount)
          } else if (sign === '+') {
            isIncome = true
            amount = Math.abs(amount)
          } else {
            amount = isIncome ? Math.abs(amount) : -Math.abs(amount)
          }

          // Estrai merchant dal title (es: "AKATHOR" o "AKATHOR: dettagli")
          let merchant = extractMerchant(title)
          
          // Se non c'è merchant e sembra un accredito, usa un valore generico
          if (!merchant || merchant === '') {
            merchant = isIncome ? 'Accredito' : 'Pagamento'
          }
          
          // Filtra offerte promozionali: controlla se la notifica contiene parole chiave tipiche delle promozioni
          // ma solo se NON contiene anche parole chiave di transazioni reali
          const promotionalKeywords = [
            /invita\s+(un\s+)?amico/i,
            /invite\s+(a\s+)?friend/i,
            /ricevi\s+\d+.*(?:invitando|invitando|se\s+inviti)/i,
            /ricevi\s+\d+.*(?:per\s+ogni|per\s+ciascun)/i,
            /offerta\s+promozionale/i,
            /promozione\s+special/i,
            /bonus\s+benvenuto/i,
            /welcome\s+bonus/i,
            /vinci\s+\d+/i,
            /win\s+\d+/i,
            /premio\s+di\s+\d+/i,
            /prize\s+of\s+\d+/i,
            /iscriviti\s+e\s+ricevi/i,
            /subscribe\s+and\s+receive/i,
            /nuovo\s+cliente/i,
            /new\s+customer/i,
            /codice\s+promozionale/i,
            /promotional\s+code/i,
            /cashback.*(?:se\s+inviti|invitando)/i,
            /referral\s+program/i,
            /programma\s+referral/i,
            /condividi\s+e\s+ricevi/i,
            /share\s+and\s+receive/i,
            /ottieni\s+\d+.*(?:invitando|se\s+inviti)/i,
            /get\s+\d+.*(?:inviting|if\s+you\s+invite)/i
          ]
          
          // Parole chiave che indicano una transazione reale (se presenti, probabilmente non è una promozione)
          const realTransactionKeywords = [
            /pagamento\s+effettuato/i,
            /payment\s+made/i,
            /accredito\s+ricevuto/i,
            /credit\s+received/i,
            /bonifico/i,
            /transfer/i,
            /addebito/i,
            /debit/i,
            /prelievo/i,
            /withdrawal/i,
            /storno/i,
            /refund/i,
            /rimborso/i,
            /ricevuto\s+da/i,
            /received\s+from/i,
            /pagato\s+a/i,
            /paid\s+to/i,
            /transazione/i,
            /transaction/i
          ]
          
          // Controlla se contiene parole chiave promozionali
          const hasPromotionalKeywords = promotionalKeywords.some(pattern => pattern.test(fullText))
          
          // Controlla se contiene parole chiave di transazioni reali
          const hasRealTransactionKeywords = realTransactionKeywords.some(pattern => pattern.test(fullText))
          
          // Se ha parole chiave promozionali MA NON ha parole chiave di transazioni reali, è probabilmente una promozione
          if (hasPromotionalKeywords && !hasRealTransactionKeywords) {
            console.log('[HEADLESS] 🚫 Promotional offer detected, skipping save')
            console.log('[HEADLESS]    Title: ' + title)
            console.log('[HEADLESS]    Text: ' + text)
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'INFO',
              message: 'Promotional offer detected, skipping save',
              source: 'HeadlessTask',
              timestamp: Date.now(),
              data: { title, text, merchant, amount }
            })
            return
          }
          
          const transactionType = isIncome ? 'income' : 'expense'
          const transactionDate = new Date().toISOString().split('T')[0]
          
          // Se è un accredito (entrata), salva come income
          if (isIncome) {
            // Determina source e category basandosi sul testo della notifica
            let source = 'other'
            let category = 'work'
            
            const lowerText = fullText
            if (/stipendio|salary|paga|payroll/i.test(lowerText)) {
              source = 'salary'
              category = 'work'
            } else if (/bonus|premio|prize/i.test(lowerText)) {
              source = 'bonus'
              category = 'work'
            } else if (/investimento|investment|dividendo|dividend/i.test(lowerText)) {
              source = 'investment'
              category = 'investment'
            } else if (/freelance|consulenza|consulting/i.test(lowerText)) {
              source = 'freelance'
              category = 'work'
            } else {
              source = 'other'
              category = 'work'
            }
            
            const incomeData = {
              amount: Math.abs(amount), // Sempre positivo per incomes
              currency,
              source,
              category,
              date: transactionDate,
              description: merchant || 'Accredito',
              raw_notification: text,
              timestamp: Date.now(),
              synced: false,
            }
            
            console.log(`[HEADLESS] 💰 Parsed ${transactionType}:`, JSON.stringify(incomeData))
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'INFO',
              message: 'Income parsed successfully',
              source: 'HeadlessTask',
              timestamp: Date.now(),
              data: { ...incomeData, transaction_type: transactionType }
            })
            
            // Salva l'entrata in un file cache separato per sincronizzarla quando l'app si apre
            const incomesFile = `${cacheDirectory}pending_incomes.json`
            let pendingIncomes = []
            
            try {
              const existingData = await readAsStringAsync(incomesFile)
              pendingIncomes = JSON.parse(existingData)
            } catch (readError) {
              console.log('[HEADLESS] No pending incomes file, creating new one')
            }
            
            // Controlla duplicati: stessa transazione negli ultimi 30 secondi
            const thirtySecondsAgo = Date.now() - 30 * 1000
            const isDuplicate = pendingIncomes.some(inc => 
              Math.abs(inc.amount) === Math.abs(amount) && 
              inc.description === incomeData.description && 
              inc.date === incomeData.date &&
              inc.timestamp > thirtySecondsAgo
            )
            
            if (isDuplicate) {
              console.log('[HEADLESS] ⚠️  Duplicate income detected, skipping save')
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
              
              DeviceEventEmitter.emit('headless_log', {
                level: 'WARN',
                message: 'Duplicate income detected, skipping save',
                source: 'HeadlessTask',
                timestamp: Date.now(),
                data: incomeData
              })
              return
            }
            
            console.log(`[HEADLESS] 💾 Saving ${transactionType} to cache for later sync...`)
            
            pendingIncomes.push(incomeData)
            
            await writeAsStringAsync(incomesFile, JSON.stringify(pendingIncomes))
            console.log('[HEADLESS] ✅ Income saved to pending queue')
            
            // Emetti evento per sincronizzazione immediata (se l'app è aperta)
            DeviceEventEmitter.emit('income:saved', {
              amount: incomeData.amount,
              description: incomeData.description,
              timestamp: Date.now()
            })
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'INFO',
              message: 'Income saved to pending queue',
              source: 'HeadlessTask',
              timestamp: Date.now(),
              data: { amount: incomeData.amount, description: incomeData.description }
            })
          } else {
            // Se è una spesa, salva come expense (logica esistente)
            const expenseData = {
              amount, // Negativo per spese
              currency,
              merchant,
              date: transactionDate,
              raw_notification: text,
              // category_id will be resolved during sync
            }
            
            console.log(`[HEADLESS] 💰 Parsed ${transactionType}:`, JSON.stringify(expenseData))
            
            DeviceEventEmitter.emit('headless_log', {
              level: 'INFO',
              message: 'Expense parsed successfully',
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
          }
          
          // Invia notifica di promemoria solo per le spese (le entrate sono già categorizzate automaticamente)
          if (!isIncome) {
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
              const notificationTitle = '💰 Nuovo Pagamento Rilevato'
              const notificationBody = `Ricordati di impostare la categoria per ${merchant} - ${Math.abs(amount)}${currency}`
            
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
          isWalletNotification: matchedBank === 'google_wallet',
          bankId: matchedBank,
        }

        await saveNotificationRecord(notificationData)
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

        await saveNotificationRecord(notificationData)
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



