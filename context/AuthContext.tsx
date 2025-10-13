import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'
import { makeRedirectUri } from 'expo-auth-session'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import 'react-native-url-polyfill/auto'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[Auth] 🔄 Auth state changed:', event, newSession ? 'User logged in' : 'User logged out')
      setSession(newSession)
      setUser(newSession?.user ?? null)
    })
    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      console.log('[Auth] 🔐 Attempting sign in...')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        console.log('[Auth] ❌ Sign in error:', error.message)
        return { error: error.message }
      }
      console.log('[Auth] ✅ Sign in successful:', data.user?.email)
      // Force state update
      setSession(data.session)
      setUser(data.user)
      return { error: undefined }
    } catch (error) {
      console.log('[Auth] ❌ Sign in exception:', error)
      return { error: 'Errore durante il login' }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      console.log('[Auth] 📝 Attempting sign up...')
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        console.log('[Auth] ❌ Sign up error:', error.message)
        return { error: error.message }
      }
      
      // Create profile if user was created and displayName is provided
      if (data.user && displayName) {
        console.log('[Auth] 👤 Creating user profile...')
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            display_name: displayName.trim()
          })
        
        if (profileError) {
          console.log('[Auth] ⚠️ Profile creation error:', profileError.message)
          // Don't fail signup if profile creation fails, just log it
        } else {
          console.log('[Auth] ✅ Profile created successfully')
        }
      }
      
      console.log('[Auth] ✅ Sign up successful:', data.user?.email)
      // Force state update
      setSession(data.session)
      setUser(data.user)
      return { error: undefined }
    } catch (error) {
      console.log('[Auth] ❌ Sign up exception:', error)
      return { error: 'Errore durante la registrazione' }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      console.log('[Auth] 🚪 Logging out user...')
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[Auth] ❌ Logout error:', error.message)
        throw error
      }
      console.log('[Auth] ✅ Logout successful')
      // Force immediate state update
      setSession(null)
      setUser(null)
    } catch (error) {
      console.error('[Auth] ❌ Logout failed:', error)
      throw error
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://finora.app/reset',
      })
      if (error) return { error: error.message }
      return { error: undefined }
    } catch (e: any) {
      return { error: e?.message || 'Errore durante il reset password' }
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      console.log('[Auth] 🌐 Google sign-in pressed')
      // In dev, prefer Expo proxy to reliably receive params; in prod use app scheme
      const redirectTo = makeRedirectUri({ scheme: 'com.kocierik.finora', path: 'auth/callback' })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // On some RN environments the auto redirect may not trigger.
          // Request the URL and open it manually as a reliable fallback.
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      console.log('[Auth] 🔗 Google sign-in data: VERI', data)
      if (error) return { error: error.message }
      if (data?.url) {
        console.log('[Auth] 🔗 Opening auth session:', data.url)
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type === 'success' && result.url) {
          console.log('[Auth] 🔎 Auth session final URL:', result.url)
          // Parse final URL, handling Dev Client wrapper (?url=...)
          let finalUrl = result.url
          try {
            const outer = new URL(result.url)
            const nested = outer.searchParams.get('url')
            if (nested) finalUrl = decodeURIComponent(nested)
          } catch {}
          console.log('[Auth] 🔎 Final callback URL to parse:', finalUrl)
          let code = ''
          let accessToken = ''
          let refreshToken = ''
          try {
            const u = new URL(finalUrl)
            code = u.searchParams.get('code') || ''
            accessToken = u.searchParams.get('access_token') || ''
            refreshToken = u.searchParams.get('refresh_token') || ''
          } catch {}
          // If tokens might be in hash fragment (implicit flow), parse it
          if ((!accessToken || !refreshToken) && finalUrl.includes('#')) {
            try {
              const hash = finalUrl.split('#')[1] || ''
              const params = new URLSearchParams(hash)
              accessToken = accessToken || params.get('access_token') || ''
              refreshToken = refreshToken || params.get('refresh_token') || ''
              code = code || params.get('code') || ''
              console.log('[Auth] 🔎 Parsed from hash:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken, hasCode: !!code })
            } catch {}
          }
          if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            if (setErr) console.log('[Auth] ❌ setSession error from auth session result:', setErr.message)
            else {
              console.log('[Auth] ✅ Session set from auth session result tokens')
              router.replace('/(tabs)')
              return { error: undefined }
            }
          } else if (code) {
            const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
            if (exchErr) console.log('[Auth] ❌ exchangeCodeForSession error from auth session result:', exchErr.message)
            else {
              console.log('[Auth] ✅ Session established via code exchange from auth session result')
              router.replace('/(tabs)')
              return { error: undefined }
            }
          } else {
            console.log('[Auth] ⚠️ No code or tokens present in auth session result URL')
          }
        } else if (result.type === 'cancel') {
          console.log('[Auth] ⚠️ Auth session cancelled by user')
        } else {
          console.log('[Auth] ⚠️ Auth session result:', result.type)
        }
      } else {
        console.log('[Auth] ⚠️ No auth URL returned; nothing to open')
      }
      // Session will update on return via deep link
      return { error: undefined }
    } catch (e: any) {
      return { error: e?.message || 'Errore during Google login' }
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, session, loading, signIn, signUp, signOut, resetPassword, signInWithGoogle }), [user, session, loading, signIn, signUp, signOut, resetPassword, signInWithGoogle])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


