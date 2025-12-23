import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { router, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import * as RNLinking from 'react-native'
import { ActivityIndicator, View } from 'react-native'
import { Brand } from '@/constants/branding'
import 'react-native-url-polyfill/auto'

// Completes the auth session if a browser was opened for OAuth
WebBrowser.maybeCompleteAuthSession()

export default function AuthCallback() {
  const params = useLocalSearchParams()
  const { user, loading } = useAuth()

  useEffect(() => {
    const attemptExchangeAndRoute = async () => {
      try {
        const searchParams = typeof params === 'object' ? params : {}
        // console.log('[AuthCallback] params:', searchParams)

        let initialUrl: string | null = null
        try {
          initialUrl = await RNLinking.Linking.getInitialURL()
          // console.log('[AuthCallback] initialURL:', initialUrl)
        } catch {}

        let callbackUrl: string | null = null
        if (initialUrl) {
          try {
            const outer = new URL(initialUrl)
            const nested = outer.searchParams.get('url')
            callbackUrl = nested ? decodeURIComponent(nested) : initialUrl
          } catch {
            callbackUrl = initialUrl
          }
        }

        let accessToken = (searchParams?.access_token as string) || ''
        let refreshToken = (searchParams?.refresh_token as string) || ''
        let code = (searchParams?.code as string) || ''

        if ((!accessToken && !refreshToken && !code) && callbackUrl) {
          try {
            const urlObj = new URL(callbackUrl)
            accessToken = accessToken || urlObj.searchParams.get('access_token') || ''
            refreshToken = refreshToken || urlObj.searchParams.get('refresh_token') || ''
            code = code || urlObj.searchParams.get('code') || ''
            // console.log('[AuthCallback] parsed from callbackUrl:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken, hasCode: !!code })
          } catch {}
        }
        // Also try parsing hash fragment for implicit flow
        if ((!accessToken && !refreshToken && !code) && callbackUrl && callbackUrl.includes('#')) {
          try {
            const hash = callbackUrl.split('#')[1] || ''
            const params = new URLSearchParams(hash)
            accessToken = accessToken || params.get('access_token') || ''
            refreshToken = refreshToken || params.get('refresh_token') || ''
            code = code || params.get('code') || ''
            // console.log('[AuthCallback] parsed from hash:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken, hasCode: !!code })
          } catch {}
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) {
            // console.log('[AuthCallback] ❌ setSession error:', error.message)
          } else {
            // console.log('[AuthCallback] ✅ Session set via implicit tokens')
          }
        }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            // console.log('[AuthCallback] ❌ exchangeCodeForSession error:', error.message)
          } else {
            // console.log('[AuthCallback] ✅ Session established via code exchange')
          }
        }
      } catch (e) {
        // console.log('[AuthCallback] ⚠️ Exception during code exchange', e)
      } finally {
        try {
          const { data: sessData } = await supabase.auth.getSession()
          // console.log('[AuthCallback] ℹ️ session after exchange:', !!sessData?.session)
        } catch {}
        router.replace('/(tabs)')
      }
    }

    if (loading) return
    if (user) {
      router.replace('/(tabs)')
      return
    }
    attemptExchangeAndRoute()
  }, [user, loading])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.colors.background.deep }}>
      <ActivityIndicator size="large" color={Brand.colors.primary.cyan} />
    </View>
  )
}


