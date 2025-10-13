import { ThemedText } from '@/components/themed-text'
import { Logo } from '@/components/ui/Logo'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { Redirect } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import '../headless-notification-listener'

// Import headless notification listener
console.log('[APP] 🚀 Importing headless notification listener...')
console.log('[APP] ✅ Headless notification listener imported successfully\n')

export default function Index() {
  const { user, loading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] = useState<boolean | null>(null)

  console.log('[Index] 🎬 Component render:', { 
    user: !!user, 
    loading, 
    checkingOnboarding, 
    shouldRedirectToOnboarding,
    email: user?.email 
  })

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [loading])

  useEffect(() => {
    console.log('[Index] 🔄 useEffect triggered:', { user: !!user, loading, email: user?.email })
    if (user && !loading) {
      console.log('[Index] 🚀 Starting onboarding check...')
      checkOnboardingStatus()
    }
  }, [user, loading])

  // Quick synchronous check for immediate redirect
  useEffect(() => {
    if (user && !loading && shouldRedirectToOnboarding === null) {
      // Only show onboarding if explicitly forced (after signup) or if user is actively in onboarding
      // Don't show onboarding just because user is "fresh" - only after explicit signup
      const hasOnboardingMetadata = (user as any)?.user_metadata?.onboarding_seen === true
      if (!hasOnboardingMetadata) {
        console.log('[Index] 🔄 No onboarding metadata found, will check storage flags')
        // Don't immediately redirect, let the async check handle it
      }
    }
  }, [user, loading, shouldRedirectToOnboarding])

  const checkOnboardingStatus = async () => {
    try {
      setCheckingOnboarding(true)
      console.log('[Index] 🔍 Checking onboarding status for user:', user?.email)
      
      // Check if onboarding should be forced (only after signup)
      const force = await AsyncStorage.getItem('@finora:forceOnboarding')
      const active = await AsyncStorage.getItem('@finora:onboardingActive')
      
      console.log('[Index] 📱 Storage flags:', { force, active })
      
      // Check server-side onboarding status
      const seenServer = (user as any)?.user_metadata?.onboarding_seen === true
      
      // Check local onboarding status
      const seenLocal = await AsyncStorage.getItem('@finora:onboardingSeen')
      
      console.log('[Index] 🎯 Onboarding checks:', { 
        force: force === '1', 
        active: active === '1', 
        seenServer, 
        seenLocal: !!seenLocal 
      })
      
      // Only show onboarding if:
      // 1. Explicitly forced after signup (force flag)
      // 2. Currently active in onboarding (active flag)
      const shouldShowOnboarding = force === '1' || active === '1'
      
      console.log('[Index] ✅ Should show onboarding:', shouldShowOnboarding)
      
      if (shouldShowOnboarding) {
        // Mark onboarding as active to persist across re-mounts
        await AsyncStorage.setItem('@finora:onboardingActive', '1')
        if (force === '1') {
          await AsyncStorage.removeItem('@finora:forceOnboarding')
        }
        setShouldRedirectToOnboarding(true)
      } else {
        setShouldRedirectToOnboarding(false)
      }
    } catch (error) {
      console.log('[Index] ❌ Error checking onboarding status:', error)
      setShouldRedirectToOnboarding(false)
    } finally {
      setCheckingOnboarding(false)
    }
  }

  // Show loading while checking auth or onboarding status
  if (loading || checkingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#0a0a0f', '#141419', '#0f0f14']}
          style={styles.backgroundGradient}
        />
        <Animated.View 
          style={[
            styles.loadingContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Logo size="xl" variant="glow" />
          <ThemedText style={styles.loadingText}>Loading...</ThemedText>
        </Animated.View>
      </View>
    )
  }

  if (!user) {
    console.log('[Index] 👤 No user, redirecting to welcome')
    return <Redirect href="/auth/welcome" />
  }

  // If we haven't checked onboarding yet, show loading
  if (shouldRedirectToOnboarding === null) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#0a0a0f', '#141419', '#0f0f14']}
          style={styles.backgroundGradient}
        />
        <Animated.View 
          style={[
            styles.loadingContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Logo size="xl" variant="glow" />
          <ThemedText style={styles.loadingText}>Checking...</ThemedText>
        </Animated.View>
      </View>
    )
  }

  console.log('[Index] 🔀 Redirecting to:', shouldRedirectToOnboarding ? '/onboarding' : '/(tabs)')
  return <Redirect href={shouldRedirectToOnboarding ? '/onboarding' : '/(tabs)'} />
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Brand.colors.background.deep,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '500',
    color: Brand.colors.text.secondary,
  },
})

