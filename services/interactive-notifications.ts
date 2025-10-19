import { supabase } from '@/lib/supabase'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export interface CategoryAction {
  id: string
  title: string
  icon: string
  color: string
}

/**
 * Configura il canale Android per notifiche interattive
 */
export async function setupInteractiveNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return

  try {
    await Notifications.setNotificationChannelAsync('interactive_category', {
      name: 'Categorizzazione Rapida',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#06b6d4',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      description: 'Notifiche interattive per categorizzare rapidamente i pagamenti',
      enableLights: true,
      showBadge: true
    })
  } catch (error) {
    console.warn('[InteractiveNotifications] Failed to setup notification channel:', error)
  }
}

/**
 * Crea le azioni per le categorie più comuni
 */
export function createCategoryActions(categories: CategoryAction[]): Notifications.NotificationAction[] {
  // Prendi le prime 4 categorie più comuni (Android ha limite di azioni)
  const topCategories = categories.slice(0, 4)
  
  return topCategories.map(category => ({
    identifier: `category_${category.id}`,
    buttonTitle: `${category.icon} ${category.title}`,
    options: {
      isDestructive: false,
      isAuthenticationRequired: false,
    }
  }))
}

/**
 * Invia una notifica interattiva per categorizzare una spesa
 */
export async function sendInteractiveCategoryNotification(
  expenseId: string,
  merchant: string,
  amount: number,
  currency: string,
  categories: CategoryAction[]
): Promise<void> {
  try {
    await setupInteractiveNotificationChannel()

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.warn('[InteractiveNotifications] Notification permission not granted')
      return
    }

    const actions = createCategoryActions(categories)

    // Configura il gestore delle notifiche per Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        })
      })
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Categorizza Pagamento', // Cambiato da 💳 a ⚡
        body: `${merchant} - ${amount}${currency}`,
        subtitle: 'Seleziona categoria',
        data: {
          type: 'interactive_category',
          expenseId: expenseId,
          merchant: merchant,
          amount: amount,
          currency: currency
        },
        categoryIdentifier: 'interactive_category',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // Aggiungi le azioni per Android
        ...(Platform.OS === 'android' && { actions })
      },
      trigger: null
    })

    console.log('[InteractiveNotifications] ✅ Interactive notification sent for', merchant)
  } catch (error) {
    console.error('[InteractiveNotifications] ❌ Failed to send interactive notification:', error)
  }
}

/**
 * Gestisce la risposta a una notifica interattiva
 */
export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
  try {
    const { actionIdentifier, notification } = response
    const data = notification.request.content.data

    if (data?.type !== 'interactive_category') {
      return
    }

    if (!actionIdentifier || !actionIdentifier.startsWith('category_')) {
      console.log('[InteractiveNotifications] No category action selected')
      return
    }

    // Estrai l'ID della categoria dall'action identifier
    const categoryId = actionIdentifier.replace('category_', '')
    const expenseId = data.expenseId

    if (!expenseId || !categoryId) {
      console.error('[InteractiveNotifications] Missing expenseId or categoryId')
      return
    }

    // Aggiorna la categoria della spesa nel database
    const { error } = await supabase
      .from('expenses')
      .update({ category_id: categoryId })
      .eq('id', expenseId)

    if (error) {
      console.error('[InteractiveNotifications] Failed to update expense category:', error)
    } else {
      console.log('[InteractiveNotifications] ✅ Expense category updated successfully')
      
      // Emetti evento per aggiornare l'UI
      const { DeviceEventEmitter } = await import('react-native')
      DeviceEventEmitter.emit('expenses:externalUpdate')
    }
  } catch (error) {
    console.error('[InteractiveNotifications] Error handling notification response:', error)
  }
}

/**
 * Configura il gestore delle risposte alle notifiche
 */
export function setupNotificationResponseHandler(): void {
  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse)
}
