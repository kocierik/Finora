import { useAuth } from '@/context/AuthContext'
import { router, usePathname } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

export default function UnmatchedRoute() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  useEffect(() => {
    if (loading) return
    if (__DEV__) console.log('[Router] Unmatched path redirected:', pathname, 'user:', !!user)
    router.replace(user ? '/(tabs)' : '/auth/welcome')
  }, [pathname, user, loading])
  return <View />
}


