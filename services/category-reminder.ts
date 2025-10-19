import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { sendDeepLinkCategoryNotification } from './deep-link-notifications'
import { sendInteractiveCategoryNotification } from './interactive-notifications'
import {
    hasNotificationBeenSent,
    markBulkReminderSent,
    markNotificationSent,
    markWeeklyBulkReminderSent,
    shouldSendBulkReminder,
    shouldSendWeeklyBulkReminder
} from './notification-tracking'
import { getUserCategoriesForNotifications } from './user-categories'

/**
 * Servizio per inviare notifiche di promemoria per impostare le categorie
 */

export interface CategoryReminderData {
  merchant: string
  amount: number
  currency: string
  expenseId?: string
}

/**
 * Configura il canale Android per le notifiche di promemoria categoria
 */
export async function setupCategoryReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return

  try {
    await Notifications.setNotificationChannelAsync('category_reminder', {
      name: 'Promemoria Categoria',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#06b6d4',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      description: 'Notifiche per ricordare di impostare la categoria dei pagamenti rilevati',
      showBadge: true
    })
  } catch (error) {
    console.warn('[CategoryReminder] Failed to setup notification channel:', error)
  }
}

/**
 * Invia una notifica di promemoria per impostare la categoria
 */
export async function sendCategoryReminder(data: CategoryReminderData): Promise<void> {
  try {
    const expenseId = data.expenseId || `pending-${Date.now()}`
    
    // Controlla se è già stata inviata una notifica per questa spesa
    const alreadySent = await hasNotificationBeenSent(expenseId)
    if (alreadySent) {
      console.log('[CategoryReminder] Notification already sent for this expense, skipping')
      return
    }

    // Assicurati che il canale sia configurato
    await setupCategoryReminderChannel()

    // Verifica i permessi
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.warn('[CategoryReminder] Notification permission not granted')
      return
    }

    // Invia la notifica
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Nuovo Pagamento Rilevato', // Cambiato da 💳 a 💰
        body: `Ricordati di impostare la categoria per ${data.merchant} - ${data.amount}${data.currency}`,
        subtitle: 'Finora',
        data: {
          type: 'category_reminder',
          expenseId: expenseId,
          merchant: data.merchant,
          amount: data.amount,
          currency: data.currency
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH
      },
      trigger: null // Invia immediatamente
    })

    // Marca che è stata inviata
    await markNotificationSent(expenseId)

    console.log('[CategoryReminder] ✅ Category reminder notification sent for', data.merchant)
  } catch (error) {
    console.error('[CategoryReminder] ❌ Failed to send category reminder:', error)
  }
}

/**
 * Invia una notifica interattiva per categorizzare immediatamente una spesa
 */
export async function sendInteractiveCategoryReminder(
  data: CategoryReminderData, 
  userId: string
): Promise<void> {
  try {
    const expenseId = data.expenseId || `pending-${Date.now()}`
    
    // Controlla se è già stata inviata una notifica per questa spesa
    const alreadySent = await hasNotificationBeenSent(expenseId)
    if (alreadySent) {
      console.log('[CategoryReminder] Notification already sent for this expense, skipping')
      return
    }

    // Su Android, usa le notifiche deep link invece di quelle interattive
    // Le notifiche interattive con azioni non funzionano sempre su Android
    if (Platform.OS === 'android') {
      await sendDeepLinkCategoryNotification(
        expenseId,
        data.merchant,
        data.amount,
        data.currency
      )
    } else {
      // Su iOS, prova le notifiche interattive
      const categories = await getUserCategoriesForNotifications(userId)
      
      if (categories.length === 0) {
        console.warn('[CategoryReminder] No categories available for interactive notification')
        // Fallback alla notifica normale
        return sendCategoryReminder(data)
      }

      // Invia la notifica interattiva
      await sendInteractiveCategoryNotification(
        expenseId,
        data.merchant,
        data.amount,
        data.currency,
        categories
      )
    }

    // Marca che è stata inviata
    await markNotificationSent(expenseId)

    console.log('[CategoryReminder] ✅ Interactive category reminder sent for', data.merchant)
  } catch (error) {
    console.error('[CategoryReminder] ❌ Failed to send interactive category reminder:', error)
    // Fallback alla notifica normale
    await sendCategoryReminder(data)
  }
}

/**
 * Invia una notifica di promemoria per spese multiple pendenti (con controllo anti-spam)
 */
export async function sendBulkCategoryReminder(count: number): Promise<void> {
  try {
    // Controlla se dovrebbe inviare il reminder (evita spam)
    const shouldSend = await shouldSendBulkReminder()
    if (!shouldSend) {
      console.log('[CategoryReminder] Skipping bulk reminder - too soon since last one')
      return
    }

    await setupCategoryReminderChannel()

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.warn('[CategoryReminder] Notification permission not granted')
      return
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📝 Spese da Categorizzare', // Cambiato da 📋 a 📝
        body: `Hai ${count} pagamento${count > 1 ? 'i' : ''} in attesa di categorizzazione`,
        subtitle: 'Finora',
        data: {
          type: 'bulk_category_reminder',
          count: count
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH
      },
      trigger: null
    })

    // Marca che è stato inviato
    await markBulkReminderSent()

    console.log('[CategoryReminder] ✅ Bulk category reminder sent for', count, 'expenses')
  } catch (error) {
    console.error('[CategoryReminder] ❌ Failed to send bulk category reminder:', error)
  }
}

/**
 * Invia una notifica di promemoria settimanale per spese multiple pendenti
 */
export async function sendWeeklyBulkCategoryReminder(count: number): Promise<void> {
  try {
    // Controlla se dovrebbe inviare il reminder settimanale
    const shouldSend = await shouldSendWeeklyBulkReminder()
    if (!shouldSend) {
      console.log('[CategoryReminder] Skipping weekly bulk reminder - already sent this week')
      return
    }

    await setupCategoryReminderChannel()

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.warn('[CategoryReminder] Notification permission not granted')
      return
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📅 Promemoria Settimanale', // Cambiato da 📋 a 📅
        body: `Hai ${count} pagamento${count > 1 ? 'i' : ''} in attesa di categorizzazione da questa settimana`,
        subtitle: 'Finora',
        data: {
          type: 'weekly_bulk_category_reminder',
          count: count
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH
      },
      trigger: null
    })

    // Marca che è stato inviato il reminder settimanale
    await markWeeklyBulkReminderSent()

    console.log('[CategoryReminder] ✅ Weekly bulk category reminder sent for', count, 'expenses')
  } catch (error) {
    console.error('[CategoryReminder] ❌ Failed to send weekly bulk category reminder:', error)
  }
}
