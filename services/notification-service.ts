import { Platform } from 'react-native'
import * as RNANL from 'react-native-android-notification-listener'

export type NotificationPermissionStatus = 'authorized' | 'denied' | 'unknown'

export interface NotificationData {
  id: string
  app: string
  title: string
  text: string
  time: string
  titleBig?: string
  subText?: string
  bigText?: string
  timestamp: number
}

/**
 * Controlla lo stato del permesso di accesso alle notifiche
 */
export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (Platform.OS !== 'android') {
    console.log('[NotificationService] ⚠️  Not Android, permission check skipped')
    return 'unknown'
  }

  try {
    console.log('[NotificationService] 🔍 Checking notification permission...')
    const status = await RNANL.getPermissionStatus()
    console.log('[NotificationService] ✅ Permission status:', status)
    return status
  } catch (error: any) {
    console.log('[NotificationService] ❌ Error checking permission:', error.message)
    console.log('[NotificationService] This is normal in Expo Dev Client')
    return 'unknown'
  }
}

/**
 * Richiede il permesso di accesso alle notifiche
 */
export async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    console.log('[NotificationService] ⚠️  Not Android, permission request skipped')
    return
  }

  try {
    console.log('[NotificationService] 📱 Requesting notification permission...')
    await RNANL.requestPermission()
    console.log('[NotificationService] ✅ Permission request sent')
  } catch (error: any) {
    console.log('[NotificationService] ❌ Error requesting permission:', error.message)
    console.log('[NotificationService] This is normal in Expo Dev Client')
  }
}

/**
 * Verifica se il dispositivo è Xiaomi/MIUI
 */
export function isXiaomiDevice(): boolean {
  if (Platform.OS !== 'android') return false
  
  const brand = Platform.constants?.Brand?.toLowerCase() || ''
  const manufacturer = Platform.constants?.Manufacturer?.toLowerCase() || ''
  
  const isXiaomi = brand.includes('xiaomi') || 
                   brand.includes('redmi') || 
                   brand.includes('poco') ||
                   manufacturer.includes('xiaomi')
  
  console.log('[NotificationService] 📱 Device check:')
  console.log('[NotificationService] ├─ Brand:', Platform.constants?.Brand)
  console.log('[NotificationService] ├─ Manufacturer:', Platform.constants?.Manufacturer)
  console.log('[NotificationService] └─ Is Xiaomi/MIUI:', isXiaomi)
  
  return isXiaomi
}

/**
 * Filtra solo le notifiche di Google Wallet
 */
export function isGoogleWalletNotification(notification: NotificationData): boolean {
  const app = notification.app?.toLowerCase() || ''
  const isWallet = app.includes('wallet') || app.includes('com.google.android.apps.wallet')
  
  if (isWallet) {
    console.log('[NotificationService] 🎯 Google Wallet notification detected:', {
      app: notification.app,
      title: notification.title,
      text: notification.text,
    })
  }
  
  return isWallet
}

/**
 * Formatta una notifica per la visualizzazione
 */
export function formatNotification(notification: any): NotificationData {
  return {
    id: `${notification.app}-${notification.time}-${Date.now()}`,
    app: notification.app || 'Unknown',
    title: notification.title || 'No title',
    text: notification.text || 'No text',
    time: notification.time || new Date().toISOString(),
    titleBig: notification.titleBig,
    subText: notification.subText,
    bigText: notification.bigText,
    timestamp: Date.now(),
  }
}

