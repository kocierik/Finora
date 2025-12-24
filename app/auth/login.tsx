import { ThemedText } from '@/components/themed-text'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

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
    if (!email.trim()) newErrors.email = t('email_required')
    if (!password.trim()) newErrors.password = t('password_required')
    if (!email.includes('@')) newErrors.email = t('email_invalid')

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setLoading(false)
      return
    }

    try {
      // console.log('[Login] 🔐 Attempting login...')
      const { error } = await signIn(email.trim(), password)
      if (error) {
        // console.log('[Login] ❌ Login error:', error)
        setErrors({ general: error })
      } else {
        // console.log('[Login] ✅ Login successful, redirecting...')
        // Success - AuthContext and main index route will handle redirect automatically
      }
    } catch (error) {
      // console.log('[Login] ❌ Login exception:', error)
      setErrors({ general: t('login_error_generic') })
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* Background Gradients */}
      <LinearGradient
        colors={[
          Brand.colors.background.deep,
          Brand.colors.background.elevated,
          Brand.colors.background.base,
        ] as any}
        style={styles.backgroundGradient}
      />
      

      <Animated.View style={[styles.floatingElement, styles.shieldIcon, { opacity: glowAnim }]}>
        <View style={styles.iconCircle}>
          <ThemedText style={styles.floatingIcon}>🛡️</ThemedText>
        </View>
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
        <ThemedText style={styles.title}>{t('login_welcome_back')}</ThemedText>
        <ThemedText style={styles.subtitle}>{t('login_subtitle')}</ThemedText>
      </Animated.View>

      {/* Form */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          <ThemedText style={styles.inputLabel}>{t('email_label')}</ThemedText>
          <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('email_placeholder')}
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
          <ThemedText style={styles.inputLabel}>{t('password_label')}</ThemedText>
          <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('password_placeholder')}
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
              {loading ? t('signing_in') : t('sign_in')}
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <ThemedText style={styles.signupText}>{t('dont_have_account')}</ThemedText>
          <Pressable onPress={() => router.push('/auth/signup')}>
            <ThemedText style={styles.signupLink}>{t('sign_up')}</ThemedText>
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
    </KeyboardAvoidingView>
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
    zIndex: 0,
  },
  shieldIcon: {
    top: height * 0.08,
    right: -30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.1)',
  },
  floatingIcon: {
    fontSize: 50,
    opacity: 0.6,
    lineHeight: 60, // Assicura che l'emoji abbia spazio verticale
    textAlign: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.colors.glass.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Brand.colors.glass.medium,
  },
  backButtonText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 20,
    color: Brand.colors.text.primary,
  },
  title: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 40,
    fontWeight: '900',
    color: Brand.colors.text.primary,
    letterSpacing: -1,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 17,
    fontWeight: '400',
    color: Brand.colors.text.secondary,
    marginTop: 12,
    lineHeight: 24,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  form: {
    paddingHorizontal: 28,
    marginTop: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 13,
    fontWeight: '700',
    color: Brand.colors.text.tertiary,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Brand.colors.glass.medium,
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'ios' ? 18 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  inputError: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  input: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 16,
    fontWeight: '500',
    color: Brand.colors.text.primary,
  },
  errorText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 12,
    color: Brand.colors.semantic.danger,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 30,
  },
  forgotPasswordText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.primary.cyan,
  },
  generalErrorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  generalErrorText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 14,
    color: '#ff8080',
    textAlign: 'center',
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 18,
    overflow: 'hidden',
    height: 60,
    shadowColor: Brand.colors.primary.cyan,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 18,
    fontWeight: '800',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  signupText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 15,
    color: Brand.colors.text.secondary,
  },
  signupLink: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 15,
    fontWeight: '800',
    color: Brand.colors.primary.cyan,
    marginLeft: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  modalGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 22,
    fontWeight: '900',
    color: Brand.colors.text.primary,
  },
  modalClose: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 24,
    color: Brand.colors.text.tertiary,
  },
  modalBody: {
    paddingVertical: 12,
  },
  modalMessage: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 16,
    color: Brand.colors.text.secondary,
    lineHeight: 24,
  },
  modalAction: {
    marginTop: 24,
    height: 54,
    borderRadius: 16,
    backgroundColor: Brand.colors.primary.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionText: {
    fontFamily: Brand.typography.fonts.primary,
    color: Brand.colors.background.deep,
    fontWeight: '800',
    fontSize: 16,
  },
})
