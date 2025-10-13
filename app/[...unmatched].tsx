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
    // Let the main index route handle the proper redirect logic including onboarding
    router.replace('/')
  }, [pathname, user, loading])
  return <View />
}


