import { ThemedText } from '@/components/themed-text'
import { Logo } from '@/components/ui/Logo'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { LinearGradient } from 'expo-linear-gradient'
import { Redirect } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import '../headless-notification-listener'

// Import headless notification listener
console.log('[APP] 🚀 Importing headless notification listener...')
console.log('[APP] ✅ Headless notification listener imported successfully\n')

export default function Index() {
  const { user, loading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

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

  if (loading) {
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

  return <Redirect href={user ? '/(tabs)' : '/auth/welcome'} />
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

