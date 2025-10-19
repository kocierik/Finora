const { withAndroidManifest } = require('@expo/config-plugins')

module.exports = function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults
    if (!manifest.application || !manifest.application[0]) return config
    const app = manifest.application[0]

    // Aggiungi meta-data per l'icona delle notifiche
    app['meta-data'] = app['meta-data'] || []
    
    // Icona delle notifiche
    const notificationIconExists = app['meta-data'].some(
      (meta) => meta['$']?.['android:name'] === 'com.google.firebase.messaging.default_notification_icon'
    )
    
    if (!notificationIconExists) {
      app['meta-data'].push({
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_icon',
          'android:resource': '@mipmap/ic_notification'
        }
      })
    }

    // Colore dell'icona
    const notificationColorExists = app['meta-data'].some(
      (meta) => meta['$']?.['android:name'] === 'com.google.firebase.messaging.default_notification_color'
    )
    
    if (!notificationColorExists) {
      app['meta-data'].push({
        $: {
          'android:name': 'com.google.firebase.messaging.default_notification_color',
          'android:resource': '@color/notification_color'
        }
      })
    }

    app.service = app.service || []
    const serviceName = 'com.finora.notifications.WalletNotificationListenerService'
    const exists = app.service.some((s) => s['$']?.['android:name'] === serviceName)
    if (!exists) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:label': 'Wallet Notification Listener',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }],
          },
        ],
      })
    }
    return config
  })
}


