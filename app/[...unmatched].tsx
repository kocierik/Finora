import { useAuth } from '@/context/AuthContext'
import { router, usePathname } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

export default function UnmatchedRoute() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  useEffect(() => {
    if (loading) return
    router.replace('/')
  }, [pathname, user, loading])
  return <View />
}


