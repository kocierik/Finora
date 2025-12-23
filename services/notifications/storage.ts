import { cacheDirectory, getInfoAsync, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import { DeviceEventEmitter } from 'react-native'
import { NotificationData } from '../notification-service'

const NOTIFICATIONS_CACHE_FILE = `${cacheDirectory}all_notifications.json`
const MAX_NOTIFICATIONS = 100 // Limite per evitare di riempire la memoria
const DEDUP_WINDOW_MS = 3000 // deduplica notifiche uguali entro 3s
const DEBOUNCE_MS = 250 // batching delle scritture ravvicinate

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingWrite: StoredNotification[] | null = null

export interface StoredNotification extends NotificationData {
  id: string
  receivedAt: number
  isWalletNotification: boolean
  bankId?: string
}

async function persistNotifications(list: StoredNotification[]) {
  const trimmed = list.slice(0, MAX_NOTIFICATIONS)
  // Debounce per ridurre I/O se arrivano burst
  pendingWrite = trimmed
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    try {
      if (pendingWrite) {
        await writeAsStringAsync(
          NOTIFICATIONS_CACHE_FILE,
          JSON.stringify(pendingWrite, null, 2)
        )
      }
    } catch (error: any) {
      console.error('[NotificationStorage] ❌ Error writing notifications:', error.message)
    } finally {
      pendingWrite = null
      debounceTimer = null
    }
  }, DEBOUNCE_MS)
}

/** Notifica l'app che il file notifiche è stato aggiornato */
export function notifyNotificationsUpdated() {
  try {
    DeviceEventEmitter.emit('notifications:updated')
  } catch {}
}

/**
 * Salva una notifica con metadati completi (StoredNotification)
 * Usato per condividere la stessa logica tra headless listener e altri punti.
 */
export async function saveNotificationRecord(storedNotification: StoredNotification): Promise<void> {
  try {
    const existing = await loadNotifications()

    // Dedup: se esiste già una notifica identica entro DEDUP_WINDOW_MS, non aggiungere
    const now = Date.now()
    const isDuplicate = existing.some(n =>
      n.app === storedNotification.app &&
      (n.title || '') === (storedNotification.title || '') &&
      (n.text || '') === (storedNotification.text || '') &&
      Math.abs((n.receivedAt || 0) - (storedNotification.receivedAt || now)) < DEDUP_WINDOW_MS
    )
    if (isDuplicate) {
      return
    }

    const updated = [storedNotification, ...existing]
    await persistNotifications(updated)
    notifyNotificationsUpdated()
  } catch (error: any) {
    console.error('[NotificationStorage] ❌ Error saving notification:', error.message)
  }
}

/**
 * Salva una notifica creandone l'ID e i metadati minimi
 */
export async function saveNotification(notification: NotificationData): Promise<void> {
  try {
    const storedNotification: StoredNotification = {
      ...notification,
      id: `${notification.app}-${notification.timestamp}-${Date.now()}`,
      receivedAt: Date.now(),
      isWalletNotification: notification.app?.toLowerCase().includes('wallet') || false
    }
    await saveNotificationRecord(storedNotification)
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
      return []
    }
    
    const data = await readAsStringAsync(NOTIFICATIONS_CACHE_FILE)
    const notifications = JSON.parse(data)
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

/**
 * Pulisce le notifiche più vecchie di 15 giorni dalla cache
 */
export async function cleanOldNotifications(): Promise<{ removed: number }> {
  try {
    const notifications = await loadNotifications()
    
    if (notifications.length === 0) {
      return { removed: 0 }
    }
    
    // Calcola la data di 15 giorni fa
    const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000)
    
    // Filtra solo le notifiche più recenti di 15 giorni
    const initialCount = notifications.length
    const filteredNotifications = notifications.filter(notification => {
      const notificationTime = typeof notification.receivedAt === 'number' 
        ? notification.receivedAt 
        : (Number((notification as any).timestamp) || 0)
      // Mantieni le notifiche più recenti di 15 giorni
      return notificationTime > fifteenDaysAgo
    })
    
    const removedCount = initialCount - filteredNotifications.length
    
    if (removedCount > 0) {
      await writeAsStringAsync(
        NOTIFICATIONS_CACHE_FILE, 
        JSON.stringify(filteredNotifications, null, 2)
      )
      console.log(`[NotificationStorage] 🧹 Cleaned ${removedCount} old notifications (older than 15 days)`)
    }
    
    return { removed: removedCount }
  } catch (error: any) {
    console.error('[NotificationStorage] ❌ Error cleaning old notifications:', error.message)
    return { removed: 0 }
  }
}


