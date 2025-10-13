import { ThemedText } from '@/components/themed-text'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

const { width, height } = Dimensions.get('window')

export default function LoginScreen() {
  const { signIn, resetPassword } = useAuth()
  const { t } = useSettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [resetModal, setResetModal] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' })

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const glowAnim = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start()

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setErrors({})

    // Validation
    const newErrors: typeof errors = {}
    if (!email.trim()) newErrors.email = 'Email è richiesta'
    if (!password.trim()) newErrors.password = 'Password è richiesta'
    if (!email.includes('@')) newErrors.email = 'Email non valida'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setLoading(false)
      return
    }

    try {
      console.log('[Login] 🔐 Attempting login...')
      const { error } = await signIn(email.trim(), password)
      if (error) {
        console.log('[Login] ❌ Login error:', error)
        setErrors({ general: error })
      } else {
        console.log('[Login] ✅ Login successful, redirecting...')
        // Success - AuthContext and main index route will handle redirect automatically
      }
    } catch (error) {
      console.log('[Login] ❌ Login exception:', error)
      setErrors({ general: 'Errore durante il login' })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      setResetModal({ visible: true, title: t('reset_password_title'), message: t('reset_password_enter_email') })
      return
    }
    const { error } = await resetPassword(email.trim())
    if (error) {
      setResetModal({ visible: true, title: t('reset_password_title'), message: error })
    } else {
      setResetModal({ visible: true, title: t('reset_password_title'), message: t('reset_password_link_sent') })
    }
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <View style={styles.container}>
      {/* Background Gradients */}
      <LinearGradient
        colors={['#0a0a0f', '#141419', '#0f0f14']}
        style={styles.backgroundGradient}
      />
      

      <Animated.View style={[styles.floatingElement, styles.shieldIcon, { opacity: glowAnim }]}>
        <ThemedText style={styles.floatingIcon}>🛡️</ThemedText>
      </Animated.View>

      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Pressable style={styles.backButton} onPress={handleBack}>
          <ThemedText style={styles.backButtonText}>←</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>Welcome back</ThemedText>
        <ThemedText style={styles.subtitle}>Sign in to your account</ThemedText>
      </Animated.View>

      {/* Form */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.form,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
        {/* Email Field */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>Email</ThemedText>
          <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Brand.colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.email && <ThemedText style={styles.errorText}>{errors.email}</ThemedText>}
        </View>

        {/* Password Field */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>Password</ThemedText>
          <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={Brand.colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.password && <ThemedText style={styles.errorText}>{errors.password}</ThemedText>}
        </View>

        {/* Forgot Password */}
        <Pressable style={styles.forgotPassword} onPress={handleForgotPassword}>
          <ThemedText style={styles.forgotPasswordText}>{t('forgot_password')}</ThemedText>
        </Pressable>

        {/* General Error */}
        {errors.general && (
          <View style={styles.generalErrorContainer}>
            <ThemedText style={styles.generalErrorText}>{errors.general}</ThemedText>
          </View>
        )}

        {/* Login Button */}
        <Pressable 
          style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? [Brand.colors.text.tertiary, Brand.colors.text.muted] : [Brand.colors.primary.cyan, Brand.colors.primary.teal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <ThemedText style={styles.loginButtonText}>
              {loading ? 'Signing in...' : 'Sign in'}
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <ThemedText style={styles.signupText}>Don't have an account? </ThemedText>
          <Pressable onPress={() => router.push('/auth/signup')}>
            <ThemedText style={styles.signupLink}>Sign up</ThemedText>
          </Pressable>
        </View>
        </Animated.View>
      </ScrollView>

      {/* Reset Password Modal - app styled */}
      <Modal
        visible={resetModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={[ 'rgba(6,182,212,0.10)', 'rgba(139,92,246,0.06)', 'transparent' ]}
              style={styles.modalGradient}
            />
            <View style={styles.modalHeaderRow}>
              <ThemedText style={styles.modalTitle}>{resetModal.title}</ThemedText>
              <Pressable onPress={() => setResetModal(prev => ({ ...prev, visible: false }))}>
                <ThemedText style={styles.modalClose}>✕</ThemedText>
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <ThemedText style={styles.modalMessage}>{resetModal.message}</ThemedText>
            </View>
            <Pressable style={styles.modalAction} onPress={() => setResetModal(prev => ({ ...prev, visible: false }))}>
              <ThemedText style={styles.modalActionText}>{t('close')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  shieldIcon: {
    top: height * 0.2,
    left: width * 0.75
  },
  floatingIcon: {
    fontSize: 24,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  backButton: {
    padding: 8,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '400',
    color: Brand.colors.text.primary,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Brand.colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: Brand.colors.text.secondary,
  },
  form: {
    paddingHorizontal: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.colors.glass.medium,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputError: {
    borderColor: Brand.colors.semantic.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  input: {
    fontSize: 16,
    fontWeight: '400',
    color: Brand.colors.text.primary,
  },
  errorText: {
    fontSize: 12,
    color: Brand.colors.semantic.danger,
    marginTop: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 32,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    color: Brand.colors.primary.cyan,
  },
  generalErrorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  generalErrorText: {
    fontSize: 14,
    color: Brand.colors.semantic.danger,
    textAlign: 'center',
  },
  loginButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: Brand.colors.glow.cyan,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.background.deep,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.primary.cyan,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: 'rgba(15,15,20,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  modalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.colors.text.primary,
  },
  modalClose: {
    fontSize: 18,
    color: Brand.colors.text.secondary,
  },
  modalBody: {
    paddingVertical: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    lineHeight: 20,
  },
  modalAction: {
    marginTop: 14,
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.35)',
  },
  modalActionText: {
    color: Brand.colors.text.primary,
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
})
