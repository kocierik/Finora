import { cacheDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import { NotificationData } from './notification-service'

const NOTIFICATIONS_CACHE_FILE = `${cacheDirectory}all_notifications.json`
const MAX_NOTIFICATIONS = 100 // Limite per evitare di riempire la memoria

export interface StoredNotification extends NotificationData {
  id: string
  receivedAt: number
  isWalletNotification: boolean
}

/**
 * Salva una notifica nella cache locale
 */
export async function saveNotification(notification: NotificationData): Promise<void> {
  try {
    // console.log('[NotificationStorage] 💾 Saving notification to cache...')
    
    // Carica le notifiche esistenti
    const existingNotifications = await loadNotifications()
    
    // Crea la notifica da salvare
    const storedNotification: StoredNotification = {
      ...notification,
      id: `${notification.app}-${notification.timestamp}-${Date.now()}`,
      receivedAt: Date.now(),
      isWalletNotification: notification.app?.toLowerCase().includes('wallet') || false
    }
    
    // Aggiungi la nuova notifica all'inizio della lista
    const updatedNotifications = [storedNotification, ...existingNotifications]
    
    // Mantieni solo le ultime MAX_NOTIFICATIONS notifiche
    const trimmedNotifications = updatedNotifications.slice(0, MAX_NOTIFICATIONS)
    
    // Salva nel file
    await writeAsStringAsync(
      NOTIFICATIONS_CACHE_FILE, 
      JSON.stringify(trimmedNotifications, null, 2)
    )
    
    // console.log('[NotificationStorage] ✅ Notification saved:', storedNotification.title)
  } catch (error: any) {
    console.error('[NotificationStorage] ❌ Error saving notification:', error.message)
  }
}

/**
 * Carica tutte le notifiche dalla cache
 */
export async function loadNotifications(): Promise<StoredNotification[]> {
  try {
    const fileInfo = await getInfoAsync(NOTIFICATIONS_CACHE_FILE)
    if (!fileInfo.exists) {
      // console.log('[NotificationStorage] 📂 No notifications cache found')
      return []
    }
    
    const data = await readAsStringAsync(NOTIFICATIONS_CACHE_FILE)
    const notifications = JSON.parse(data)
    
    // console.log('[NotificationStorage] 📂 Loaded', notifications.length, 'notifications from cache')
    return notifications
  } catch (error: any) {
    console.error('[NotificationStorage] ❌ Error loading notifications:', error.message)
    return []
  }
}

/**
 * Cancella tutte le notifiche dalla cache
 */
export async function clearNotifications(): Promise<void> {
  try {
    await writeAsStringAsync(NOTIFICATIONS_CACHE_FILE, JSON.stringify([]))
    // console.log('[NotificationStorage] ✅ All notifications cleared')
  } catch (error: any) {
    console.error('[NotificationStorage] ❌ Error clearing notifications:', error.message)
  }
}

/**
 * Filtra le notifiche per app
 */
export function filterNotificationsByApp(
  notifications: StoredNotification[], 
  appName?: string
): StoredNotification[] {
  if (!appName) return notifications
  
  return notifications.filter(notification => 
    notification.app.toLowerCase().includes(appName.toLowerCase())
  )
}

/**
 * Filtra solo le notifiche di Google Wallet
 */
export function getWalletNotifications(notifications: StoredNotification[]): StoredNotification[] {
  return notifications.filter(notification => notification.isWalletNotification)
}

/**
 * Filtra le notifiche per data
 */
export function filterNotificationsByDate(
  notifications: StoredNotification[],
  startDate?: Date,
  endDate?: Date
): StoredNotification[] {
  return notifications.filter(notification => {
    const notificationDate = new Date(notification.receivedAt)
    
    if (startDate && notificationDate < startDate) return false
    if (endDate && notificationDate > endDate) return false
    
    return true
  })
}

/**
 * Ordina le notifiche per data (più recenti prima)
 */
export function sortNotificationsByDate(notifications: StoredNotification[]): StoredNotification[] {
  return notifications.sort((a, b) => {
    const aTime = typeof a.receivedAt === 'number' ? a.receivedAt : (Number((a as any).timestamp) || 0)
    const bTime = typeof b.receivedAt === 'number' ? b.receivedAt : (Number((b as any).timestamp) || 0)
    return bTime - aTime
  })
}
