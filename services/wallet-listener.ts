import { useAuth } from '@/context/AuthContext'
import { saveExpense } from '@/services/expenses'
import { Expense } from '@/types'
import * as FileSystem from 'expo-file-system'
import { useEffect } from 'react'
import { DeviceEventEmitter, Platform } from 'react-native'
import { sendInteractiveCategoryReminder } from './category-reminder'
import { logger } from './logger'
import { checkNotificationPermission, requestNotificationPermission } from './notification-service'
import { isMonitoredBank } from './bank-preferences'

const CACHE_FILE = (FileSystem as any).documentDirectory 
  ? `${(FileSystem as any).documentDirectory}offline-expenses.json` 
  : ''

// Cache in-memory per deduplication
const processedExpenses = new Set<string>()

async function readCache(): Promise<Expense[]> {
  try {
    const exists = await FileSystem.getInfoAsync(CACHE_FILE)
    if (!exists.exists) return []
    const txt = await FileSystem.readAsStringAsync(CACHE_FILE)
    return JSON.parse(txt)
  } catch (error: any) {
    // console.log('[WalletListener] ❌ Error reading cache:', error.message)
    return []
  }
}

async function writeCache(items: Expense[]) {
  try {
    await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(items))
    // console.log('[WalletListener] ✅ Cache written:', items.length, 'items')
  } catch (error: any) {
    // console.log('[WalletListener] ❌ Error writing cache:', error.message)
  }
}

export function useWalletListener() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (Platform.OS !== 'android') {
      // console.log('[WalletListener] ⚠️  Not Android, listener disabled')
      return
    }
    
    if (loading) {
      // console.log('[WalletListener] ⏳ Auth still loading, waiting...')
      return
    }
    
    if (!user) {
      // console.log('[WalletListener] ⚠️  No user logged in, listener disabled')
      return
    }

    if (logger && logger.info) {
      logger.info('Initializing wallet listener', { userId: user.id }, 'WalletListener')
    }
    // console.log('[WalletListener] 🚀 Initializing wallet listener for user:', user.id)

    const handlePayload = async (payload: any) => {
      // Double check user is still logged in
      if (!user) {
        // console.log('[WalletListener] ⚠️  User logged out during notification processing, skipping')
        return
      }
      
      const timestamp = new Date().toISOString()
      
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      // console.log(`[WalletListener] ${timestamp}`)
      // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      try {
        // console.log('[WalletListener] 📱 Incoming notification payload from ANY APP:')
        // console.log(JSON.stringify(payload, null, 2))
      } catch {
        // console.log('[WalletListener] 📱 Incoming notification (non-serializable)')
      }
      
      // Controlla se è una notifica di una banca monitorata
      const appPackage = payload.app || payload.packageName || ''
      const isMonitored = await isMonitoredBank(appPackage)
      
      // Mantieni retrocompatibilità con il flag isWalletNotification
      const isWalletNotification = payload.isWalletNotification || isMonitored
      
      if (isWalletNotification) {
        // console.log('[WalletListener] 🎯 Monitored bank notification detected (app is open)')
        
        // Estrai i dati della spesa dalla notifica
        const title = payload.title || ''
        const text = payload.text || ''
        const fullText = (title + ' ' + text).toLowerCase()
        
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
          // console.log('[WalletListener] 🚫 Promotional offer detected, skipping interactive notification')
          return
        }
        
        // Parse la spesa (stesso pattern del headless task)
        const amountMatch = text.match(/([\d.,]+)\s*([€$£])/i)
        if (amountMatch) {
          const amount = parseFloat(amountMatch[1].replace(',', '.'))
          const currency = amountMatch[2]
          
          // Estrai merchant dal title
          let merchant = title
          if (title.includes(':')) {
            merchant = title.split(':')[0].trim()
          }
          
          // Invia notifica interattiva per categorizzare immediatamente
          try {
            await sendInteractiveCategoryReminder({
              merchant,
              amount,
              currency,
              expenseId: `pending-${Date.now()}`
            }, user.id)
            
            // console.log('[WalletListener] ✅ Interactive category reminder sent for', merchant)
          } catch (error) {
            // console.log('[WalletListener] ⚠️  Failed to send interactive category reminder:', error)
          }
        }
      }
      
      // Il headless task salva già le notifiche E le spese in memoria quando l'app è chiusa
      // Quando l'app è aperta, le notifiche arrivano tramite DeviceEventEmitter
      // ma il headless task continua a funzionare e salva tutto, quindi evitiamo duplicati
      // console.log('[WalletListener] ℹ️  Notification received via DeviceEventEmitter (app is open)')
      // console.log('[WalletListener] ℹ️  Headless task should have already saved this notification and expense')
      
      // DISABILITATO: Non salvare quando l'app è aperta per evitare duplicati
      // Il headless task si occupa di tutto sia quando l'app è chiusa che aperta
      // console.log('[WalletListener] ⏭️  Skipping expense save to avoid duplicates with headless task')
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        return
    }

    // Listener per notifiche simulate (test)
    // console.log('[WalletListener] 📡 Setting up DeviceEventEmitter listener...')
    const devEmitterSub = DeviceEventEmitter.addListener('wallet_notification', handlePayload)
    // console.log('[WalletListener] ✅ DeviceEventEmitter listener registered')

    // Inizializzazione permessi e cache
    ;(async () => {
      try {
        // console.log('[WalletListener] 🔐 Checking notification permission...')
        const permissionStatus = await checkNotificationPermission()
        // console.log('[WalletListener] 🔐 Permission status:', permissionStatus)
        
        if (permissionStatus !== 'authorized') {
          // console.log('[WalletListener] ⚠️  Permission not granted, requesting...')
          await requestNotificationPermission()
        } else {
          // console.log('[WalletListener] ✅ Permission already granted')
        }
      } catch (error: any) {
        // console.log('[WalletListener] ❌ Error checking/requesting permission:', error.message)
      }
      
      // Flush cached expenses
      // console.log('[WalletListener] 💾 Checking for cached expenses...')
      const cached = await readCache()
      // console.log('[WalletListener] 💾 Found', cached.length, 'cached expenses')
      
      if (cached.length > 0) {
        // console.log('[WalletListener] 💾 Flushing cached expenses...')
        for (const e of cached) {
          // console.log('[WalletListener] 💾 Saving cached expense:', e)
          await saveExpense(e)
        }
        await writeCache([])
        // console.log('[WalletListener] ✅ Cached expenses flushed')
      }
    })()

    // Listen for headless logs
    const headlessLogSubscription = DeviceEventEmitter.addListener('headless_log', (logData) => {
      if (logger && logger.info) {
        const { level, message, source, timestamp, data } = logData
        const logEntry = {
          id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp,
          level,
          message,
          data,
          source
        }
        
        // Add directly to logger
        if (level === 'INFO') logger.info(message, data, source)
        else if (level === 'WARN') logger.warn(message, data, source)
        else if (level === 'ERROR') logger.error(message, data, source)
        else if (level === 'DEBUG') logger.debug(message, data, source)
      }
    })

    // console.log('[WalletListener] ✅ Wallet listener initialized\n')

    return () => {
      // console.log('[WalletListener] 🛑 Cleaning up wallet listener...')
      devEmitterSub.remove()
      headlessLogSubscription.remove()
      // console.log('[WalletListener] ✅ Wallet listener cleaned up\n')
    }
  }, [user?.id, loading])
}

