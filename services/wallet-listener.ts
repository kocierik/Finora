import { useAuth } from '@/context/AuthContext'
import { saveExpense } from '@/services/expenses'
import { Expense } from '@/types'
import * as FileSystem from 'expo-file-system'
import { useEffect } from 'react'
import { DeviceEventEmitter, Platform } from 'react-native'
import { isMonitoredBank } from './bank-preferences'
import { sendInteractiveCategoryReminder } from './category-reminder'
import { logger } from './logger'
import { checkNotificationPermission, requestNotificationPermission } from './notification-service'
import { extractAmountAndCurrency, extractMerchant, isPromotionalNotification } from './notifications/parser'

const CACHE_FILE = (FileSystem as any).documentDirectory 
  ? `${(FileSystem as any).documentDirectory}offline-expenses.json` 
  : ''

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

        // Usa la stessa logica del headless per filtrare promozioni pure
        if (isPromotionalNotification(title, text)) {
          // console.log('[WalletListener] 🚫 Promotional offer detected, skipping interactive notification')
          return
        }
        
        // Parse la spesa (stesso pattern del headless task)
        const parsedAmount = extractAmountAndCurrency(text)
        if (parsedAmount) {
          const { amount, currency } = parsedAmount
          const merchant = extractMerchant(title)
          
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
        const { level, message, source, data } = logData
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

