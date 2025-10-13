import { useAuth } from '@/context/AuthContext'
import { parseBBVANotification, parseWalletNotification, saveExpense } from '@/services/expenses'
import { Expense } from '@/types'
import * as FileSystem from 'expo-file-system'
import { useEffect } from 'react'
import { DeviceEventEmitter, Platform } from 'react-native'
import { checkNotificationPermission, requestNotificationPermission } from './notification-service'

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
    console.log('[WalletListener] ❌ Error reading cache:', error.message)
    return []
  }
}

async function writeCache(items: Expense[]) {
  try {
    await FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(items))
    console.log('[WalletListener] ✅ Cache written:', items.length, 'items')
  } catch (error: any) {
    console.log('[WalletListener] ❌ Error writing cache:', error.message)
  }
}

export function useWalletListener() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (Platform.OS !== 'android') {
      console.log('[WalletListener] ⚠️  Not Android, listener disabled')
      return
    }
    
    if (loading) {
      console.log('[WalletListener] ⏳ Auth still loading, waiting...')
      return
    }
    
    if (!user) {
      console.log('[WalletListener] ⚠️  No user logged in, listener disabled')
      return
    }

    console.log('[WalletListener] 🚀 Initializing wallet listener for user:', user.id)

    const handlePayload = async (payload: any) => {
      // Double check user is still logged in
      if (!user) {
        console.log('[WalletListener] ⚠️  User logged out during notification processing, skipping')
        return
      }
      
      const timestamp = new Date().toISOString()
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`[WalletListener] ${timestamp}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      try {
        console.log('[WalletListener] 📱 Incoming notification payload from ANY APP:')
        console.log(JSON.stringify(payload, null, 2))
      } catch {
        console.log('[WalletListener] 📱 Incoming notification (non-serializable)')
      }
      
      // Il headless task salva già le notifiche in memoria quando l'app è chiusa
      // Quando l'app è aperta, le notifiche arrivano tramite DeviceEventEmitter
      // e vengono già salvate dal headless task, quindi non duplichiamo
      console.log('[WalletListener] ℹ️  Notification received via DeviceEventEmitter (app is open)')
      console.log('[WalletListener] ℹ️  Headless task should have already saved this notification')
      
      // Filtra per Google Wallet o BBVA per il salvataggio delle spese
      const pkg = payload?.packageName || payload?.package || payload?.app || ''
      console.log('[WalletListener] 🔍 Package name detected:', pkg)
      console.log('[WalletListener] 🔍 Checking if it contains "wallet", "com.google.android.apps.wallet" or "bbva"...')
      
      // Debug più dettagliato per capire il formato delle notifiche
      console.log('[WalletListener] 🔍 Full payload keys:', Object.keys(payload || {}))
      console.log('[WalletListener] 🔍 Payload structure:', {
        packageName: payload?.packageName,
        package: payload?.package,
        app: payload?.app,
        android: payload?.android,
        notification: payload?.notification
      })
      
      const isWallet = pkg && (pkg.includes('com.google.android.apps.wallet') || pkg.includes('wallet'))
      const isBBVA = pkg && pkg.toLowerCase().includes('bbva')
      
      if (!isWallet && !isBBVA) {
        console.log('[WalletListener] ⏭️  Not a supported finance app notification (package: ' + pkg + '), skipping expense save')
        console.log('[WalletListener] ℹ️  Notification should be saved to memory by headless task!')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        return
      }
      console.log(`[WalletListener] 🎯 ${isWallet ? 'Google Wallet' : 'BBVA'} notification detected!`)
      
      // Estrai il testo della notifica
      const title = payload?.title || ''
      const text = payload?.text || payload?.bigText || payload?.android?.text || ''
      console.log('[WalletListener] 📝 Notification title:', title)
      console.log('[WalletListener] 📝 Notification text:', text)
      
      // Parsa la notifica in base all'origine
      const parsed = isWallet ? parseWalletNotification(title, text) : parseBBVANotification(title, text)
      console.log('[WalletListener] 🔍 Parsed data:', parsed)
      
      if (!parsed.amount || !parsed.date) {
        console.log('[WalletListener] ⚠️  Missing amount or date, skipping expense save')
        console.log('[WalletListener] ℹ️  Notification should be saved to memory by headless task!')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        return
      }
      
      const expense: Expense = {
        user_id: user.id,
        amount: parsed.amount!,
        currency: parsed.currency,
        merchant: parsed.merchant ?? (isWallet ? 'Google Wallet' : 'BBVA'),
        date: parsed.date!,
        raw_notification: text,
      }
      
      console.log('[WalletListener] 💾 Saving expense:', expense)
      
      const { error } = await saveExpense(expense)
      
      if (error) {
        console.log('[WalletListener] ❌ Error saving expense:', error)
        console.log('[WalletListener] 💾 Caching expense for later...')
        const cached = await readCache()
        cached.push(expense)
        await writeCache(cached)
      } else {
        console.log('[WalletListener] ✅ Expense saved successfully!')
      }
      
      console.log('[WalletListener] ℹ️  Notification should be saved to memory by headless task!')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    }

    // Listener per notifiche simulate (test)
    console.log('[WalletListener] 📡 Setting up DeviceEventEmitter listener...')
    const devEmitterSub = DeviceEventEmitter.addListener('wallet_notification', handlePayload)
    console.log('[WalletListener] ✅ DeviceEventEmitter listener registered')

    // Inizializzazione permessi e cache
    ;(async () => {
      try {
        console.log('[WalletListener] 🔐 Checking notification permission...')
        const permissionStatus = await checkNotificationPermission()
        console.log('[WalletListener] 🔐 Permission status:', permissionStatus)
        
        if (permissionStatus !== 'authorized') {
          console.log('[WalletListener] ⚠️  Permission not granted, requesting...')
          await requestNotificationPermission()
        } else {
          console.log('[WalletListener] ✅ Permission already granted')
        }
      } catch (error: any) {
        console.log('[WalletListener] ❌ Error checking/requesting permission:', error.message)
      }
      
      // Flush cached expenses
      console.log('[WalletListener] 💾 Checking for cached expenses...')
      const cached = await readCache()
      console.log('[WalletListener] 💾 Found', cached.length, 'cached expenses')
      
      if (cached.length > 0) {
        console.log('[WalletListener] 💾 Flushing cached expenses...')
        for (const e of cached) {
          console.log('[WalletListener] 💾 Saving cached expense:', e)
          await saveExpense(e)
        }
        await writeCache([])
        console.log('[WalletListener] ✅ Cached expenses flushed')
      }
    })()

    console.log('[WalletListener] ✅ Wallet listener initialized\n')

    return () => {
      console.log('[WalletListener] 🛑 Cleaning up wallet listener...')
      devEmitterSub.remove()
      console.log('[WalletListener] ✅ Wallet listener cleaned up\n')
    }
  }, [user?.id, loading])
}

