import { ThemedText } from '@/components/themed-text'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

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
      // console.log('[Signup] 📝 Attempting signup...')
      const { error } = await signUp(email.trim(), password, name.trim())
      if (error) {
        // console.log('[Signup] ❌ Signup error:', error)
        setErrors({ general: error })
      } else {
        // console.log('[Signup] ✅ Signup successful, redirecting...')
        // Force navigation to index to trigger onboarding check
        setTimeout(() => {
          // console.log('[Signup] 🔄 Navigating to index...')
          router.replace('/')
        }, 100)
      }
    } catch (error) {
      // console.log('[Signup] ❌ Signup exception:', error)
      setErrors({ general: t('signup_error_generic') })
    } finally {
      setLoading(false)
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
      
      
      <Animated.View style={[styles.floatingElement, styles.rocketIcon, { opacity: glowAnim }]}>
        <View style={styles.iconCircle}>
          <ThemedText style={styles.floatingIcon}>🚀</ThemedText>
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
        <ThemedText style={styles.title}>{t('create_account_title')}</ThemedText>
        <ThemedText style={styles.subtitle}>{t('create_account_subtitle')}</ThemedText>
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
  rocketIcon: {
    top: height * 0.06,
    right: -30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(217, 70, 239, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.1)',
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 14,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Brand.colors.glass.medium,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: Brand.colors.primary.magenta,
    backgroundColor: Brand.colors.primary.magenta,
  },
  checkmark: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 14,
    fontWeight: '900',
    color: Brand.colors.background.deep,
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 14,
    color: Brand.colors.text.secondary,
    lineHeight: 20,
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
  signupButton: {
    borderRadius: 18,
    overflow: 'hidden',
    height: 60,
    shadowColor: Brand.colors.primary.magenta,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  signupButtonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupButtonText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 18,
    fontWeight: '800',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  loginText: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 15,
    color: Brand.colors.text.secondary,
  },
  loginLink: {
    fontFamily: Brand.typography.fonts.primary,
    fontSize: 15,
    fontWeight: '800',
    color: Brand.colors.primary.cyan,
    marginLeft: 6,
  },
})
