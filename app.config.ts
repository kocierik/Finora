import 'dotenv/config'
import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Finora',
  slug: 'finora',
  version: '1.0.1',
  backgroundColor: '#0a0a0f',
  userInterfaceStyle: 'dark',
  android: {
    package: 'com.kocierik.finora',
    versionCode: 2,
    backgroundColor: '#0a0a0f',
    adaptiveIcon: {
      backgroundColor: '#0a0a0f',
      foregroundImage: './assets/images/icon.png',
    },
    permissions: [
      'POST_NOTIFICATIONS',
    ],
  },
  ios: {
    backgroundColor: '#0a0a0f',
    icon: './assets/images/icon.png',
  },
  web: {
    backgroundColor: '#0a0a0f',
    favicon: './assets/images/icon.png',
  },
  extra: {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  },
}

export default config

