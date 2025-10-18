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

export default function Index() {
  const { user, loading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const [checkingOnboarding, setCheckingOnboarding] = useState(false)
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] = useState<boolean | null>(null)



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

  // Check onboarding status when user is authenticated
  useEffect(() => {
    if (user && !loading) {
      checkOnboardingStatus()
    }
  }, [user, loading])


  const checkOnboardingStatus = async () => {
    try {
      setCheckingOnboarding(true)
      
      // Check if onboarding should be forced (only after signup)
      const force = await AsyncStorage.getItem('@finora:forceOnboarding')
      const active = await AsyncStorage.getItem('@finora:onboardingActive')
      
      
      // Check server-side onboarding status
      const seenServer = (user as any)?.user_metadata?.onboarding_seen === true
      
      // Check local onboarding status
      const seenLocal = await AsyncStorage.getItem('@finora:onboardingSeen')
      

      // Only show onboarding if:
      // 1. Explicitly forced after signup (force flag)
      // 2. Currently active in onboarding (active flag)
      const shouldShowOnboarding = force === '1' || active === '1'
      
      
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

  // console.log('[Index] 🔀 Redirecting to:', shouldRedirectToOnboarding ? '/onboarding' : '/(tabs)')
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

