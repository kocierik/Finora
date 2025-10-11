const { withAndroidManifest } = require('@expo/config-plugins')

module.exports = function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults
    if (!manifest.application || !manifest.application[0]) return config
    const app = manifest.application[0]

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


