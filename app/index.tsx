import { useAuth } from '@/context/AuthContext'
import { Redirect } from 'expo-router'
import '../headless-notification-listener'

// Import headless notification listener
console.log('[APP] 🚀 Importing headless notification listener...')
console.log('[APP] ✅ Headless notification listener imported successfully\n')

export default function Index() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Redirect href={user ? '/(tabs)' : '/auth'} />
}

