import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import { loadExpenseThresholds, saveExpenseThresholds, type ExpenseThresholds } from '@/services/expense-thresholds'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

export default function ProfileScreen() {
  const { user, signOut, loading: authLoading } = useAuth()
  const { language, locale, currency, enableBiometrics, sessionTimeoutMinutes, setLanguage, setLocale, setCurrency, setEnableBiometrics, setSessionTimeoutMinutes, monthlyBudget, setMonthlyBudget, t } = useSettings()
  const [displayName, setDisplayName] = useState('')
  const [currentDisplayName, setCurrentDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [expenseThresholds, setExpenseThresholds] = useState<ExpenseThresholds>({ moderate: 1000, high: 1500 })
  const [thresholdsLoading, setThresholdsLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const scaleAnim1 = useRef(new Animated.Value(0.95)).current
  const scaleAnim2 = useRef(new Animated.Value(0.95)).current
  const scaleAnim3 = useRef(new Animated.Value(0.95)).current

  // Note: Avoid early returns before hooks; render guards applied just before JSX return

  useEffect(() => {
    ;(async () => {
      if (!user) return
      
      // Carica dati del profilo
      const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      const metaName = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || ''
      const identityName = (user as any)?.identities?.[0]?.identity_data?.name || ''
      const fallbackEmailName = (user?.email || '').split('@')[0] || ''
      const derived = (data?.display_name || metaName || identityName || fallbackEmailName || '').trim()
      if (data) {
        const name = data.display_name ?? ''
        setDisplayName(name || derived)
        setCurrentDisplayName(name || derived)
      } else {
        // Se non c'è un profilo, inizializzalo con un nome derivato se disponibile
        if (derived) {
          try {
            await supabase.from('profiles').upsert({ id: user.id, display_name: derived })
          } catch {}
        }
        setDisplayName(derived)
        setCurrentDisplayName(derived)
      }
      
      // Carica soglie delle spese
      try {
        const thresholds = await loadExpenseThresholds()
        setExpenseThresholds(thresholds)
      } catch (error) {
        console.log('[Profile] ⚠️  Error loading expense thresholds:', error)
      }
    })()

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim1, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim2, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim3, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [user?.id])

  const save = async () => {
    if (!user) return
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName })
    setLoading(false)
    if (error) {
      setSuccessMessage(t('error_prefix') + error.message)
      setShowSuccessModal(true)
    } else {
      setCurrentDisplayName(displayName)
      setSuccessMessage(t('profile_updated_success'))
      setShowSuccessModal(true)
    }
  }

  const saveThresholds = async () => {
    try {
      setThresholdsLoading(true)
      await saveExpenseThresholds(expenseThresholds)
      setSuccessMessage(t('thresholds_updated_success'))
      setShowSuccessModal(true)
    } catch (error: any) {
      setSuccessMessage(t('error_prefix') + (error.message || t('thresholds_save_error_generic')))
      setShowSuccessModal(true)
    } finally {
      setThresholdsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

  // Durante il logout/redirect mostra caricamento invece di errore
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <Animated.View 
        style={[
          styles.premiumHeader,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <ThemedText style={styles.userInitial}>
                {currentDisplayName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </ThemedText>
        </View>
            <View style={styles.userDetails}>
              <ThemedText type="heading" style={styles.userName}>
                {currentDisplayName || (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name || (user?.email || '').split('@')[0] || 'Utente'}
              </ThemedText>
              <ThemedText type="body" style={styles.userEmail}>
                {user?.email}
              </ThemedText>
        </View>
      </View>
        </View>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* Impostazioni Account */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim1 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
        <View style={styles.cardHeader}>
            <ThemedText type="heading" style={styles.cardTitle}>{t('account_settings')}</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>👤</ThemedText>
        </View>
              <View style={styles.settingContent}>
                <ThemedText type="label" style={styles.settingLabel}>{t('name')}</ThemedText>
            <TextInput 
                  style={styles.settingInput} 
              value={displayName} 
              onChangeText={setDisplayName} 
              placeholder="Il tuo nome"
              placeholderTextColor={Brand.colors.text.muted}
            />
          </View>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>📧</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText type="label" style={styles.settingLabel}>{t('email_address')}</ThemedText>
                <ThemedText type="body" style={styles.settingValue}>{user?.email}</ThemedText>
              </View>
            </View>
          </View>
          <Pressable 
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={save} 
            disabled={loading}
            onPressIn={() => Animated.spring(scaleAnim1, { toValue: 0.95, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim1, { toValue: 1, useNativeDriver: true }).start()}
          >
            <ThemedText type="label" style={styles.primaryButtonText}>
              {loading ? t('saving_changes') : t('save_changes')}
              </ThemedText>
          </Pressable>
      </Card>
        </Animated.View>

        {/* Impostazioni Finanziarie */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim2 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
        <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('financial_settings')}</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>💰</ThemedText>
        </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>{language === 'it' ? 'Soglia Moderata (€)' : 'Moderate Threshold (€)'}</ThemedText>
                <TextInput 
                  style={styles.settingInput} 
                  value={expenseThresholds.moderate.toString()} 
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0
                    setExpenseThresholds(prev => ({ ...prev, moderate: value }))
                  }} 
                  placeholder="1000"
                  placeholderTextColor={Brand.colors.text.muted}
                  keyboardType="numeric"
                />
                <ThemedText style={styles.settingDescription}>
                  {language === 'it' ? 'Le spese da' : 'Expenses from'} {expenseThresholds.moderate}€ {language === 'it' ? 'a' : 'to'} {expenseThresholds.high}€ {language === 'it' ? 'sono considerate moderate' : 'are considered moderate'}
          </ThemedText>
              </View>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>📈</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>{language === 'it' ? 'Soglia Alta (€)' : 'High Threshold (€)'}</ThemedText>
                <TextInput 
                  style={styles.settingInput} 
                  value={expenseThresholds.high.toString()} 
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0
                    setExpenseThresholds(prev => ({ ...prev, high: value }))
                  }} 
                  placeholder="1500"
                  placeholderTextColor={Brand.colors.text.muted}
                  keyboardType="numeric"
                />
                <ThemedText style={styles.settingDescription}>
                  {language === 'it' ? 'Le spese superiori a' : 'Expenses above'} {expenseThresholds.high}€ {language === 'it' ? 'sono considerate alte' : 'are considered high'}
                </ThemedText>
              </View>
            </View>
          </View>
          <Pressable 
            style={[styles.primaryButton, thresholdsLoading && styles.primaryButtonDisabled]}
            onPress={saveThresholds} 
            disabled={thresholdsLoading}
            onPressIn={() => Animated.spring(scaleAnim2, { toValue: 0.95, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim2, { toValue: 1, useNativeDriver: true }).start()}
          >
            <ThemedText style={styles.primaryButtonText}>
              {thresholdsLoading ? t('saving_changes') : t('save_thresholds')}
            </ThemedText>
          </Pressable>
        </Card>
        </Animated.View>

        {/* App Actions */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim3 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('app_actions')}</ThemedText>
          </View>
          <View style={styles.actionList}>
            <Pressable 
              style={styles.actionItem}
              onPress={() => router.push('/notifications')}
            >
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>🔔</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>{t('notifications')}</ThemedText>
                <ThemedText style={styles.actionDescription}>{t('notifications_desc')}</ThemedText>
                <ThemedText style={styles.actionMeta}>Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</ThemedText>
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionItem}
              onPress={() => Alert.alert(language === 'it' ? 'Sicurezza' : 'Security', language === 'it' ? 'Gestisci autenticazione, sessioni e permessi (presto disponibile).' : 'Manage authentication, sessions and permissions (coming soon).')}
            >
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>🔐</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>{t('security')}</ThemedText>
                <ThemedText style={styles.actionDescription}>{t('security_desc')}</ThemedText>
                <ThemedText style={styles.actionMeta}>Account: {user?.email}</ThemedText>
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.actionItem}
              onPress={() => Alert.alert(language === 'it' ? 'Supporto' : 'Support', language === 'it' ? 'Scrivici a support@finora.app o consulta le FAQ (presto disponibile).' : 'Write us at support@finora.app or check the FAQ (coming soon).')}
            >
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>ℹ️</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>{t('support')}</ThemedText>
                <ThemedText style={styles.actionDescription}>{t('support_desc')}</ThemedText>
                <ThemedText style={styles.actionMeta}>{t('support_email_label')}: support@finora.app</ThemedText>
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
          </View>
        </Card>
        </Animated.View>

        {/* Lingua e Formati */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim2 }]
            }
          ]}
        >
          <Card variant="default" style={styles.premiumCard}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('language_formats')}</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>🌐</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>{t('language_label')}</ThemedText>
                <View style={styles.langChipsContainer}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={language === 'it' ? 'Lingua Italiano selezionata' : 'Seleziona Italiano'}
                    style={[
                      styles.langChip,
                      language === 'it' && styles.langChipActive,
                    ]}
                    onPress={() => { setLanguage('it'); setLocale('it-IT') }}
                  >
                    <ThemedText style={[styles.langChipText, language === 'it' && styles.langChipTextActive]}>IT</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={language === 'en' ? 'English language selected' : 'Select English'}
                    style={[
                      styles.langChip,
                      language === 'en' && styles.langChipActive,
                    ]}
                    onPress={() => { setLanguage('en'); setLocale('en-US') }}
                  >
                    <ThemedText style={[styles.langChipText, language === 'en' && styles.langChipTextActive]}>EN</ThemedText>
                  </Pressable>
                </View>
            </View>
          </View>
        </View>
      </Card>
        </Animated.View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
      <Pressable 
            style={[styles.logoutButton, loading && styles.logoutButtonDisabled]} 
        onPress={async () => {
          try {
            setLoading(true)
                console.log('[Profile] 🚪 Starting logout process...')
            await signOut()
            console.log('[Profile] ✅ Logout completed, redirecting...')
                setTimeout(() => {
                  console.log('[Profile] 🔄 Redirecting to welcome screen...')
                }, 100)
          } catch (error) {
            console.error('[Profile] ❌ Logout failed:', error)
                Alert.alert('Error', 'Unable to logout. Please try again.')
            setLoading(false)
          }
        }}
        disabled={loading}
      >
        <ThemedText style={styles.logoutButtonText}>
              {loading ? (language === 'it' ? 'Disconnessione...' : 'Signing out...') : (language === 'it' ? 'Esci' : 'Sign Out')}
        </ThemedText>
      </Pressable>
      </View>
    </ScrollView>

      {/* Custom Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
            <Card  style={styles.modalCard}>
              <View style={styles.modalContent}>
                <View style={styles.modalIcon}>
                  <ThemedText style={styles.modalIconText}>
                    {successMessage.includes('Errore') ? '❌' : '✅'}
                  </ThemedText>
                </View>
                <ThemedText type="heading" style={styles.modalTitle}>
                  {successMessage.includes('Errore') ? (language === 'it' ? 'Errore' : 'Error') : (language === 'it' ? 'Completato' : 'Done')}
                </ThemedText>
                <ThemedText type="body" style={styles.modalMessage}>
                  {successMessage}
                </ThemedText>
                <Pressable 
                  style={styles.modalButton}
                  onPress={() => setShowSuccessModal(false)}
                >
                  <ThemedText type="label" style={styles.modalButtonText}>
                    {language === 'it' ? 'Chiudi' : 'Close'}
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          </Animated.View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  premiumHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: 'rgba(6, 182, 212, 0.02)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#06b6d4',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.colors.text.primary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  brandHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
    position: 'relative',
  },
  brandGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  appIcon: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 2,
  },
  brandInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  versionBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.colors.primary.cyan,
  },
  premiumCard: {
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.text.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    opacity: 0.7,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  valueSmall: {
    fontSize: 12,
    opacity: 0.8,
    fontFamily: 'monospace',
  },
  helpText: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 4,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Brand.colors.glass.light,
    marginVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.colors.glass.medium,
    backgroundColor: Brand.colors.background.elevated,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    fontSize: 15,
    color: Brand.colors.text.primary,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  notificationsContent: {
    gap: 16,
  },
  notificationsDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    color: Brand.colors.text.secondary,
  },
  notificationsButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  notificationsButtonGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.colors.background.deep,
    letterSpacing: 0.5,
  },
  notificationsButtonIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.colors.background.deep,
  },
  aboutContent: {
    gap: 20,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 13,
    opacity: 0.8,
    flex: 1,
  },
  logoutButton: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.colors.semantic.danger,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.5,
  },
  footerCopyright: {
    fontSize: 11,
    opacity: 0.4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8EEF8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 16,
    fontWeight: '400',
    color: '#9ca3af',
    textAlign: 'center',
  },
  // New premium styles
  settingsList: {
    gap: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconText: {
    fontSize: 18,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 8,
  },
  settingInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Brand.colors.text.primary,
  },
  settingValue: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
    marginTop: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: Brand.colors.text.tertiary,
    marginTop: 6,
    lineHeight: 16,
  },
  primaryButton: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderColor: 'rgba(6,182,212,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E8EEF8',
  },
  actionList: {
    gap: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(6,182,212,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.15)',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionIconText: {
    fontSize: 18,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: Brand.colors.text.secondary,
  },
  actionMeta: {
    fontSize: 11,
    color: Brand.colors.text.tertiary,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 18,
    color: '#06b6d4',
    marginLeft: 8,
  },
  langChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  langChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    backgroundColor: 'rgba(6,182,212,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipActive: {
    backgroundColor: 'rgba(6,182,212,0.18)',
    borderColor: 'rgba(6,182,212,0.45)'
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#E8EEF8',
  },
  langChipTextActive: {
    color: '#06b6d4',
  },
  logoutSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    padding: 0,
  },
  modalContent: {
    alignItems: 'center',
    padding: 24,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconText: {
    fontSize: 32,
  },
  modalTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
})


