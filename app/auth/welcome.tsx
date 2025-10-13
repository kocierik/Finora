import { ThemedText } from '@/components/themed-text'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Image, Pressable, StyleSheet, View } from 'react-native'

const { width, height } = Dimensions.get('window')

export default function WelcomeScreen() {
  const { signInWithGoogle } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const glowAnim = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start()

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const handleLogin = () => {
    router.push('/auth/login')
  }

  const handleSignUp = () => {
    router.push('/auth/signup')
  }

  return (
    <View style={styles.container}>
      {/* Background Gradients */}
      <LinearGradient
        colors={['#0a0a0f', '#141419', '#0f0f14']}
        style={styles.backgroundGradient}
      />
      
      {/* Floating Background Elements */}
      <Animated.View style={[styles.floatingElement, styles.walletIcon, { opacity: glowAnim }]}>
        <ThemedText style={styles.floatingIcon}>💳</ThemedText>
      </Animated.View>
      
      <Animated.View style={[styles.floatingElement, styles.coinIcon, { opacity: glowAnim }]}>
        <ThemedText style={styles.floatingIcon}>💰</ThemedText>
      </Animated.View>
      
      <Animated.View style={[styles.floatingElement, styles.graphIcon, { opacity: glowAnim }]}>
        <ThemedText style={styles.floatingIcon}>📈</ThemedText>
      </Animated.View>

      {/* Main Content */}
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image 
            source={require('@/assets/images/icon.png')} 
            style={styles.appIcon}
            resizeMode="contain"
          />
          <ThemedText style={styles.appName}>{Brand.name}</ThemedText>
          <ThemedText style={styles.tagline}>{Brand.tagline}</ThemedText>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Pressable style={styles.loginButton} onPress={handleLogin}>
            <LinearGradient
              colors={[Brand.colors.primary.cyan, Brand.colors.primary.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <ThemedText style={styles.buttonText}>Log in</ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.signupButton} onPress={handleSignUp}>
            <LinearGradient
              colors={['rgba(6, 182, 212, 0.1)', 'transparent', 'rgba(6, 182, 212, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signupButtonGradient}
            >
              <ThemedText style={styles.signupButtonText}>Sign up</ThemedText>
            </LinearGradient>
          </Pressable>

          {/* Google Sign-In */}
          <Pressable style={styles.googleButton} onPress={async () => { await signInWithGoogle() }}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signupButtonGradient}
            >
              <ThemedText style={styles.signupButtonText}>Continue with Google</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
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
  floatingElement: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  walletIcon: {
    top: height * 0.12,
    right: width * 0.08,
  },
  coinIcon: {
    top: height * 0.25,
    left: width * 0.08,
  },
  graphIcon: {
    top: height * 0.35,
    right: width * 0.12,
  },
  floatingIcon: {
    fontSize: 22,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 80,
    paddingHorizontal: 20,
  },
  appIcon: {
    width: 120,
    height: 120,
    borderRadius: 30,
    marginBottom: 8,
  },
  appName: {
    fontSize: 56,
    fontWeight: '900',
    color: Brand.colors.text.primary,
    marginTop: 32,
    letterSpacing: -2,
    textAlign: 'center',
    lineHeight: 64,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '400',
    color: Brand.colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Brand.colors.glow.cyan,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  signupButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.colors.primary.cyan,
    overflow: 'hidden',
  },
  signupButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    letterSpacing: 0.5,
  },
  googleButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
})
