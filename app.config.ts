import 'dotenv/config'
import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'finora',
  slug: 'finora',
  scheme: 'finora',
  android: {
    package: 'com.kocierik.finora',
    permissions: [
      'POST_NOTIFICATIONS',
    ],
  },
  extra: {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
  },
}

export default config

