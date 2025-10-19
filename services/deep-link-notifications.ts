import * as Notifications from 'expo-notifications'
import { Linking } from 'react-native'

/**
 * Invia una notifica che apre l'app direttamente alla spesa da categorizzare
 */
export async function sendDeepLinkCategoryNotification(
  expenseId: string,
  merchant: string,
  amount: number,
  currency: string
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.warn('[DeepLinkNotifications] Notification permission not granted')
      return
    }

    // Crea un deep link per aprire l'app alla spesa specifica
    const deepLink = `finora://expense/${expenseId}`
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔗 Categorizza Pagamento', // Cambiato da 💳 a 🔗
        body: `Tocca per categorizzare ${merchant} - ${amount}${currency}`,
        subtitle: 'Finora',
        data: {
          type: 'deep_link_category',
          expenseId: expenseId,
          merchant: merchant,
          amount: amount,
          currency: currency,
          deepLink: deepLink
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH
      },
      trigger: null
    })

    console.log('[DeepLinkNotifications] ✅ Deep link notification sent for', merchant)
  } catch (error) {
    console.error('[DeepLinkNotifications] ❌ Failed to send deep link notification:', error)
  }
}

/**
 * Gestisce il tap sulla notifica deep link
 */
export async function handleDeepLinkNotification(response: Notifications.NotificationResponse): Promise<void> {
  try {
    const { notification } = response
    const data = notification.request.content.data

    if (data?.type !== 'deep_link_category') {
      return
    }

    const deepLink = data.deepLink
    if (deepLink) {
      // Apri l'app con il deep link
      await Linking.openURL(deepLink)
      console.log('[DeepLinkNotifications] ✅ Deep link opened:', deepLink)
    }
  } catch (error) {
    console.error('[DeepLinkNotifications] Error handling deep link notification:', error)
  }
}

/**
 * Configura il gestore delle notifiche deep link
 */
export function setupDeepLinkNotificationHandler(): void {
  Notifications.addNotificationResponseReceivedListener(handleDeepLinkNotification)
}
