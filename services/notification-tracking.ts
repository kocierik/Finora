import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'

interface NotificationTracking {
  lastBulkReminderSent: number | null
  lastWeeklyReminderSent: number | null
  sentNotifications: { [key: string]: number } // expenseId -> timestamp
}

const TRACKING_FILE = `${cacheDirectory}notification_tracking.json`

/**
 * Carica i dati di tracking delle notifiche
 */
export async function loadNotificationTracking(): Promise<NotificationTracking> {
  try {
    const data = await readAsStringAsync(TRACKING_FILE)
    const parsed = JSON.parse(data)
    return {
      lastBulkReminderSent: parsed.lastBulkReminderSent || null,
      lastWeeklyReminderSent: parsed.lastWeeklyReminderSent || null,
      sentNotifications: parsed.sentNotifications || {}
    }
  } catch (error) {
    // Se il file non esiste, restituisci valori di default
    return {
      lastBulkReminderSent: null,
      lastWeeklyReminderSent: null,
      sentNotifications: {}
    }
  }
}

/**
 * Salva i dati di tracking delle notifiche
 */
export async function saveNotificationTracking(tracking: NotificationTracking): Promise<void> {
  try {
    await writeAsStringAsync(TRACKING_FILE, JSON.stringify(tracking))
  } catch (error) {
    console.warn('[NotificationTracking] Failed to save tracking data:', error)
  }
}

/**
 * Controlla se è passata una settimana dall'ultimo bulk reminder
 */
export async function shouldSendWeeklyBulkReminder(): Promise<boolean> {
  const tracking = await loadNotificationTracking()
  const now = Date.now()
  
  // Se non è mai stato inviato un reminder settimanale, invialo
  if (!tracking.lastWeeklyReminderSent) {
    return true
  }
  
  // Controlla se è passata una settimana (7 giorni = 7 * 24 * 60 * 60 * 1000 ms)
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000
  const timeSinceLastReminder = now - tracking.lastWeeklyReminderSent
  
  return timeSinceLastReminder >= oneWeekInMs
}

/**
 * Marca che è stato inviato un bulk reminder settimanale
 */
export async function markWeeklyBulkReminderSent(): Promise<void> {
  const tracking = await loadNotificationTracking()
  tracking.lastWeeklyReminderSent = Date.now()
  await saveNotificationTracking(tracking)
}

/**
 * Controlla se è passato abbastanza tempo dall'ultimo bulk reminder (per evitare spam)
 */
export async function shouldSendBulkReminder(): Promise<boolean> {
  const tracking = await loadNotificationTracking()
  const now = Date.now()
  
  // Se non è mai stato inviato un reminder, invialo
  if (!tracking.lastBulkReminderSent) {
    return true
  }
  
  // Controlla se è passata almeno 1 ora dall'ultimo reminder (per evitare spam)
  const oneHourInMs = 60 * 60 * 1000
  const timeSinceLastReminder = now - tracking.lastBulkReminderSent
  
  return timeSinceLastReminder >= oneHourInMs
}

/**
 * Marca che è stato inviato un bulk reminder
 */
export async function markBulkReminderSent(): Promise<void> {
  const tracking = await loadNotificationTracking()
  tracking.lastBulkReminderSent = Date.now()
  await saveNotificationTracking(tracking)
}

/**
 * Controlla se è già stata inviata una notifica per questa spesa
 */
export async function hasNotificationBeenSent(expenseId: string): Promise<boolean> {
  const tracking = await loadNotificationTracking()
  const sentTime = tracking.sentNotifications[expenseId]
  
  if (!sentTime) {
    return false
  }
  
  // Considera duplicata se inviata negli ultimi 5 minuti
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  return sentTime > fiveMinutesAgo
}

/**
 * Marca che è stata inviata una notifica per questa spesa
 */
export async function markNotificationSent(expenseId: string): Promise<void> {
  const tracking = await loadNotificationTracking()
  tracking.sentNotifications[expenseId] = Date.now()
  
  // Pulisci le notifiche vecchie (più di 24 ore)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  Object.keys(tracking.sentNotifications).forEach(key => {
    if (tracking.sentNotifications[key] < oneDayAgo) {
      delete tracking.sentNotifications[key]
    }
  })
  
  await saveNotificationTracking(tracking)
}
