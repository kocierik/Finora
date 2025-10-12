import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { loadExpenseThresholds, saveExpenseThresholds, type ExpenseThresholds } from '@/services/expense-thresholds'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

export default function ProfileScreen() {
  const { user, signOut, loading: authLoading } = useAuth()
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

  // Auth guard - redirect if not logged in
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Caricamento...</ThemedText>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>Accesso non autorizzato</ThemedText>
        <ThemedText style={styles.errorSubtext}>Effettua il login per continuare</ThemedText>
      </View>
    )
  }

  useEffect(() => {
    ;(async () => {
      if (!user) return
      
      // Carica dati del profilo
      const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      if (data) {
        const name = data.display_name ?? ''
        setDisplayName(name)
        setCurrentDisplayName(name)
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
      setSuccessMessage('Errore: ' + error.message)
      setShowSuccessModal(true)
    } else {
      setCurrentDisplayName(displayName) // Aggiorna il nome visualizzato solo dopo il salvataggio
      setSuccessMessage('Profilo aggiornato con successo!')
      setShowSuccessModal(true)
    }
  }

  const saveThresholds = async () => {
    try {
      setThresholdsLoading(true)
      await saveExpenseThresholds(expenseThresholds)
      setSuccessMessage('Soglie delle spese aggiornate con successo!')
      setShowSuccessModal(true)
    } catch (error: any) {
      setSuccessMessage('Errore: ' + (error.message || 'Impossibile salvare le soglie'))
      setShowSuccessModal(true)
    } finally {
      setThresholdsLoading(false)
    }
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
                {currentDisplayName || 'Utente'}
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

        {/* Account Settings */}
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
            <ThemedText type="heading" style={styles.cardTitle}>Account Settings</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>👤</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText type="label" style={styles.settingLabel}>Nome</ThemedText>
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
                <ThemedText type="label" style={styles.settingLabel}>Email Address</ThemedText>
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
              {loading ? 'Saving...' : 'Save Changes'}
            </ThemedText>
          </Pressable>
        </Card>
        </Animated.View>

        {/* Financial Settings */}
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
            <ThemedText style={styles.cardTitle}>Financial Settings</ThemedText>
          </View>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>💰</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>Moderate Threshold (€)</ThemedText>
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
                  Expenses from {expenseThresholds.moderate}€ to {expenseThresholds.high}€ are considered moderate
                </ThemedText>
              </View>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <ThemedText style={styles.settingIconText}>📈</ThemedText>
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>High Threshold (€)</ThemedText>
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
                  Expenses above {expenseThresholds.high}€ are considered high
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
              {thresholdsLoading ? 'Saving...' : 'Save Thresholds'}
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
            <ThemedText style={styles.cardTitle}>App Actions</ThemedText>
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
                <ThemedText style={styles.actionLabel}>Notifications</ThemedText>
                <ThemedText style={styles.actionDescription}>View transaction notifications</ThemedText>
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
            <Pressable style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>🔐</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>Security</ThemedText>
                <ThemedText style={styles.actionDescription}>Manage your security settings</ThemedText>
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
            <Pressable style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <ThemedText style={styles.actionIconText}>ℹ️</ThemedText>
              </View>
              <View style={styles.actionContent}>
                <ThemedText style={styles.actionLabel}>Help & Support</ThemedText>
                <ThemedText style={styles.actionDescription}>Get help and contact support</ThemedText>
              </View>
              <ThemedText style={styles.actionArrow}>→</ThemedText>
            </Pressable>
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
              {loading ? 'Signing out...' : 'Sign Out'}
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
                  {successMessage.includes('Errore') ? 'Errore' : 'Completato'}
                </ThemedText>
                <ThemedText type="body" style={styles.modalMessage}>
                  {successMessage}
                </ThemedText>
                <Pressable 
                  style={styles.modalButton}
                  onPress={() => setShowSuccessModal(false)}
                >
                  <ThemedText type="label" style={styles.modalButtonText}>
                    Chiudi
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
    backgroundColor: '#06b6d4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionList: {
    gap: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 12,
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
  actionArrow: {
    fontSize: 18,
    color: Brand.colors.text.tertiary,
    marginLeft: 8,
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


