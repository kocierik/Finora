import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
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

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      console.log('[Auth] 📝 Attempting sign up...')
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        console.log('[Auth] ❌ Sign up error:', error.message)
        return { error: error.message }
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
    } catch (error) {
      console.error('[Auth] ❌ Logout failed:', error)
      throw error
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, session, loading, signIn, signUp, signOut }), [user, session, loading, signIn, signUp, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


