import { ThemedText } from '@/components/themed-text'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

const { width, height } = Dimensions.get('window')

export default function SignupScreen() {
  const { signUp } = useAuth()
  const { t } = useSettings()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ 
    name?: string; 
    email?: string; 
    password?: string; 
    confirmPassword?: string; 
    terms?: string; 
    general?: string 
  }>({})

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

  const handleSignUp = async () => {
    setLoading(true)
    setErrors({})

    // Validation
    const newErrors: typeof errors = {}
    if (!name.trim()) newErrors.name = t('name_required')
    if (!email.trim()) newErrors.email = t('email_required')
    if (!email.includes('@')) newErrors.email = t('email_invalid')
    if (!password.trim()) newErrors.password = t('password_required')
    if (password.length < 6) newErrors.password = t('password_min_length')
    if (password !== confirmPassword) newErrors.confirmPassword = t('passwords_do_not_match')
    if (!agreeToTerms) newErrors.terms = t('must_accept_terms')

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      setLoading(false)
      return
    }

    try {
      console.log('[Signup] 📝 Attempting signup...')
      const { error } = await signUp(email.trim(), password, name.trim())
      if (error) {
        console.log('[Signup] ❌ Signup error:', error)
        setErrors({ general: error })
      } else {
        console.log('[Signup] ✅ Signup successful, redirecting...')
        // Force navigation to index to trigger onboarding check
        setTimeout(() => {
          console.log('[Signup] 🔄 Navigating to index...')
          router.replace('/')
        }, 100)
      }
    } catch (error) {
      console.log('[Signup] ❌ Signup exception:', error)
      setErrors({ general: t('signup_error_generic') })
    } finally {
      setLoading(false)
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
      
      
      <Animated.View style={[styles.floatingElement, styles.rocketIcon, { opacity: glowAnim }]}>
        <ThemedText style={styles.floatingIcon}>🚀</ThemedText>
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
        <ThemedText style={styles.title}>{t('create_account_title')}</ThemedText>
        <ThemedText style={styles.subtitle}>{t('create_account_subtitle')}</ThemedText>
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
        {/* Name Field */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>{t('name_label')}</ThemedText>
          <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('name_placeholder')}
              placeholderTextColor={Brand.colors.text.tertiary}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
          {errors.name && <ThemedText style={styles.errorText}>{errors.name}</ThemedText>}
        </View>

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
              placeholder={t('create_password_placeholder')}
              placeholderTextColor={Brand.colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.password && <ThemedText style={styles.errorText}>{errors.password}</ThemedText>}
        </View>

        {/* Confirm Password Field */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>{t('confirm_password_label')}</ThemedText>
          <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('confirm_password_placeholder')}
              placeholderTextColor={Brand.colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errors.confirmPassword && <ThemedText style={styles.errorText}>{errors.confirmPassword}</ThemedText>}
        </View>

        {/* Terms & Conditions */}
        <Pressable 
          style={styles.termsContainer}
          onPress={() => setAgreeToTerms(!agreeToTerms)}
        >
          <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
            {agreeToTerms && <ThemedText style={styles.checkmark}>✓</ThemedText>}
          </View>
          <View style={styles.termsTextContainer}>
            <ThemedText style={styles.termsText}>{t('terms_agree_text')}</ThemedText>
          </View>
        </Pressable>
        {errors.terms && <ThemedText style={styles.errorText}>{errors.terms}</ThemedText>}

        {/* General Error */}
        {errors.general && (
          <View style={styles.generalErrorContainer}>
            <ThemedText style={styles.generalErrorText}>{errors.general}</ThemedText>
          </View>
        )}

        {/* Sign Up Button */}
        <Pressable 
          style={[styles.signupButton, loading && styles.signupButtonDisabled]} 
          onPress={handleSignUp}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? [Brand.colors.text.tertiary, Brand.colors.text.muted] : [Brand.colors.primary.magenta, Brand.colors.primary.cyan]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <ThemedText style={styles.signupButtonText}>
              {loading ? t('creating_account') : t('create_account')}
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <ThemedText style={styles.loginText}>{t('already_have_account')}</ThemedText>
          <Pressable onPress={() => router.push('/auth/login')}>
            <ThemedText style={styles.loginLink}>{t('log_in')}</ThemedText>
          </Pressable>
        </View>
        </Animated.View>
      </ScrollView>
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
    backgroundColor: UI_CONSTANTS.MAGENTA_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: UI_CONSTANTS.MAGENTA_BORDER,
  },

  rocketIcon: {
    top: height * 0.14,
    left: width * 0.75,
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  form: {
    paddingHorizontal: 32,
  },
  inputContainer: {
    marginBottom: 20,
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
    backgroundColor: UI_CONSTANTS.DANGER_BG,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Brand.colors.glass.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: Brand.colors.primary.cyan,
    backgroundColor: Brand.colors.primary.cyan,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.colors.background.deep,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    lineHeight: 20,
  },
  termsLink: {
    color: Brand.colors.primary.cyan,
    fontWeight: '600',
  },
  generalErrorContainer: {
    backgroundColor: UI_CONSTANTS.DANGER_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.DANGER_BORDER,
  },
  generalErrorText: {
    fontSize: 14,
    color: Brand.colors.semantic.danger,
    textAlign: 'center',
  },
  signupButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: Brand.colors.glow.magenta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.background.deep,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  loginText: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.primary.cyan,
  },
})
