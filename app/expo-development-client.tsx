import { useAuth } from '@/context/AuthContext'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import { View } from 'react-native'

WebBrowser.maybeCompleteAuthSession()

export default function DevClientSingleRoute() {
  const { user, loading } = useAuth()
  useEffect(() => {
    if (loading) return
    router.replace(user ? '/(tabs)' : '/auth/welcome')
  }, [user, loading])

  return <View />
}


