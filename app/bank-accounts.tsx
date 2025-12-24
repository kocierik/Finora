import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useSettings } from '@/context/SettingsContext'
import { BankConnection, disconnectBank, getBankConnections, initiateBankConnection, listBanks, syncBankTransactions } from '@/services/banking'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'

export default function BankAccountsScreen() {
  const { language } = useSettings()
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showBankPicker, setShowBankPicker] = useState(false)
  const [banksLoading, setBanksLoading] = useState(false)
  const [banks, setBanks] = useState<Array<{ name: string; country: string }>>([])
  const [bankSearch, setBankSearch] = useState('')
  const [selectedCountry] = useState<'IT'>('IT')

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      setLoading(true)
      const data = await getBankConnections()
      setConnections(data)
    } catch (error) {
      console.error('Error loading bank connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const openBankPicker = async () => {
    try {
      setShowBankPicker(true)
      setBanksLoading(true)
      const list = await listBanks(selectedCountry)
      setBanks(list)
    } catch (error: any) {
      Alert.alert(
        language === 'it' ? 'Errore' : 'Error',
        error?.message || (language === 'it' ? 'Impossibile caricare la lista banche' : 'Failed to load bank list')
      )
      setShowBankPicker(false)
    } finally {
      setBanksLoading(false)
    }
  }

  const handleConnectBank = async (bankName: string) => {
    try {
      setConnecting(true)
      const result = await initiateBankConnection(bankName, selectedCountry)
      if (result.success) {
        Alert.alert(
          language === 'it' ? 'Successo' : 'Success',
          language === 'it' ? 'Conto collegato con successo!' : 'Bank account connected successfully!'
        )
        loadConnections()
      }
    } catch (error: any) {
      Alert.alert(
        language === 'it' ? 'Errore' : 'Error',
        error.message || (language === 'it' ? 'Impossibile collegare il conto' : 'Unable to connect account')
      )
    } finally {
      setConnecting(false)
    }
  }

  const handleSyncTransactions = async () => {
    try {
      setSyncing(true)
      const result = await syncBankTransactions()
      Alert.alert(
        language === 'it' ? 'Sincronizzazione' : 'Sync',
        language === 'it' 
          ? `Completato! Sincronizzate ${result.synced} nuove transazioni.` 
          : `Done! Synced ${result.synced} new transactions.`
      )
    } catch (error: any) {
      Alert.alert(
        language === 'it' ? 'Errore' : 'Error',
        language === 'it' ? 'Sincronizzazione fallita.' : 'Sync failed.'
      )
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteConnection = (id: string) => {
    Alert.alert(
      language === 'it' ? 'Disconnetti' : 'Disconnect',
      language === 'it' ? 'Sei sicuro di voler rimuovere questo conto?' : 'Are you sure you want to remove this account?',
      [
        { text: language === 'it' ? 'Annulla' : 'Cancel', style: 'cancel' },
        { 
          text: language === 'it' ? 'Rimuovi' : 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectBank(id)
              loadConnections()
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect')
            }
          }
        }
      ]
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <ThemedText style={styles.backIcon}>←</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            {language === 'it' ? 'Conti Bancari (Open Banking)' : 'Bank Accounts (Open Banking)'}
          </ThemedText>
          <View style={{ width: 36 }} />
        </View>

        {/* Info Card */}
        <Card style={[styles.infoCard, styles.glassCard]}>
          <LinearGradient
            colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassCardGradient}
            pointerEvents="none"
          />
          <ThemedText style={styles.infoTitle}>
            {language === 'it' ? 'Sincronizzazione Automatica' : 'Automatic Sync'}
          </ThemedText>
          <ThemedText style={styles.infoText}>
            {language === 'it' 
              ? 'Collega i tuoi conti in modo sicuro tramite Open Banking (PSD2). Finora scaricherà le transazioni automaticamente, senza leggere le tue credenziali.'
              : 'Connect your accounts securely via Open Banking (PSD2). Finora will download transactions automatically, without reading your credentials.'}
          </ThemedText>
        </Card>

        {/* Connections List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Brand.colors.primary.cyan} />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {connections.length === 0 ? (
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyText}>
                  {language === 'it' ? 'Nessun conto collegato' : 'No connected accounts'}
                </ThemedText>
              </View>
            ) : (
              <>
                <Pressable 
                  style={[styles.syncButton, syncing && styles.disabledButton]} 
                  onPress={handleSyncTransactions}
                  disabled={syncing}
                >
                  {syncing ? (
                    <ActivityIndicator color={Brand.colors.primary.cyan} />
                  ) : (
                    <ThemedText style={styles.syncButtonText}>
                      🔄 {language === 'it' ? 'Sincronizza transazioni ora' : 'Sync transactions now'}
                    </ThemedText>
                  )}
                </Pressable>

                {connections.map((conn) => (
                  <Card key={conn.id} style={styles.connectionCard}>
                    <View style={styles.connectionContent}>
                      <View style={styles.bankIcon}>
                        <ThemedText style={styles.bankIconText}>🏦</ThemedText>
                      </View>
                      <View style={styles.connectionInfo}>
                        <ThemedText style={styles.bankName}>{conn.bank_name}</ThemedText>
                        <ThemedText style={styles.expiryText}>
                          {language === 'it' ? 'Scade il: ' : 'Expires on: '}
                          {new Date(conn.access_expires_at).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      <Pressable 
                        onPress={() => handleDeleteConnection(conn.id)}
                        style={styles.deleteButton}
                      >
                        <ThemedText style={styles.deleteIconText}>🗑️</ThemedText>
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* 
        ========================================
        🚧 BANK CONNECTION UI - TEMPORARILY DISABLED
        Waiting for GoCardless integration (free alternative)
        ========================================
      */}
      
      {/* Coming Soon Banner */}
      <View style={styles.fixedButtonContainer}>
        <View style={styles.comingSoonBanner}>
          <ThemedText style={styles.comingSoonEmoji}>🏦</ThemedText>
          <ThemedText style={styles.comingSoonTitle}>
            {language === 'it' ? 'Collegamento banca in arrivo!' : 'Bank connection coming soon!'}
          </ThemedText>
          <ThemedText style={styles.comingSoonText}>
            {language === 'it' 
              ? 'Stiamo integrando GoCardless per permetterti di collegare gratuitamente i tuoi conti italiani.' 
              : 'We are integrating GoCardless to let you connect your Italian accounts for free.'}
          </ThemedText>
        </View>
      </View>

      {/* 
      -- COMMENTED OUT: Connect Button --
      <View style={styles.fixedButtonContainer}>
        <Pressable 
          style={[styles.connectButton, connecting && styles.disabledButton]}
          onPress={openBankPicker}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color={Brand.colors.background.deep} />
          ) : (
            <ThemedText style={styles.connectButtonText}>
              {language === 'it' ? '+ Collega Nuovo Conto' : '+ Connect New Account'}
            </ThemedText>
          )}
        </Pressable>
        <ThemedText style={styles.privacyNote}>
          {language === 'it' 
            ? 'Sicuro e criptato. I tuoi dati restano privati.' 
            : 'Secure and encrypted. Your data remains private.'}
        </ThemedText>
      </View>
      */}

      {/* 
      -- COMMENTED OUT: Bank picker modal --
      <Modal
        visible={showBankPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.bankPickerCard}>
            <LinearGradient
              colors={UI_CONSTANTS.GRADIENT_CYAN_BG_CARD}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bankPickerGradient}
              pointerEvents="none"
            />
            <View style={styles.bankPickerHeader}>
              <ThemedText style={styles.bankPickerTitle}>
                {language === 'it' ? 'Scegli la tua banca' : 'Choose your bank'}
              </ThemedText>
              <Pressable onPress={() => setShowBankPicker(false)} style={styles.pickerCloseButton}>
                <ThemedText style={styles.pickerCloseButtonText}>✕</ThemedText>
              </Pressable>
            </View>

            <View style={styles.bankSearchWrap}>
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder={language === 'it' ? 'Cerca banca…' : 'Search bank…'}
                placeholderTextColor={Brand.colors.text.muted}
                style={styles.bankSearchInput}
              />
            </View>

            {banksLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={Brand.colors.primary.cyan} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {banks
                  .filter((b) => b.name?.toLowerCase().includes(bankSearch.trim().toLowerCase()))
                  .slice(0, 200)
                  .map((b) => (
                    <Pressable
                      key={`${b.country}-${b.name}`}
                      onPress={async () => {
                        setShowBankPicker(false)
                        setBankSearch('')
                        await handleConnectBank(b.name)
                      }}
                      style={({ pressed }) => [
                        styles.bankRow,
                        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                      ]}
                    >
                      <ThemedText style={styles.bankRowText}>{b.name}</ThemedText>
                      <ThemedText style={styles.bankRowChevron}>›</ThemedText>
                    </Pressable>
                  ))}
              </ScrollView>
            )}
          </Card>
        </View>
      </Modal>
      */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.colors.background.deep,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
  },
  backIcon: {
    fontSize: 20,
    marginBottom: 8,
    opacity: 0.9,
  },
  headerTitle: {
    textAlign: 'center',
    flex: 1,
  },
  infoCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    overflow: 'hidden',
  },
  glassCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    borderRadius: 20,
  },
  glassCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: Brand.colors.primary.cyan,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
  listContainer: {
    gap: 12,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    opacity: 0.5,
    fontSize: 16,
  },
  syncButton: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: Brand.colors.primary.teal + '20',
    borderWidth: 1,
    borderColor: Brand.colors.primary.teal + '40',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncButtonText: {
    color: Brand.colors.primary.cyan,
    fontWeight: '600',
  },
  connectionCard: {
    padding: 0,
    borderRadius: 16,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
  },
  connectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIconText: {
    fontSize: 24,
  },
  connectionInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
  },
  expiryText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIconText: {
    fontSize: 18,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 40,
    backgroundColor: Brand.colors.background.deep,
    borderTopWidth: 1,
    borderTopColor: UI_CONSTANTS.GLASS_BORDER,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: UI_CONSTANTS.MODAL_OVERLAY_MEDIUM,
    padding: 16,
    justifyContent: 'center',
  },
  bankPickerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    padding: 16,
  },
  bankPickerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bankPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCloseButtonText: {
    color: Brand.colors.text.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
  bankPickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.colors.text.primary,
  },
  bankSearchWrap: {
    marginBottom: 10,
  },
  bankSearchInput: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_SM,
    color: Brand.colors.text.primary,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: UI_CONSTANTS.GLASS_BG_XS,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_XS,
    marginBottom: 8,
  },
  bankRowText: {
    flex: 1,
    color: Brand.colors.text.primary,
    fontWeight: '600',
  },
  bankRowChevron: {
    color: Brand.colors.text.tertiary,
    fontSize: 22,
    marginLeft: 10,
  },
  connectButton: {
    backgroundColor: Brand.colors.primary.cyan,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: Brand.colors.background.deep,
    fontWeight: '700',
    fontSize: 16,
  },
  privacyNote: {
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.5,
  },
  // Coming soon banner styles
  comingSoonBanner: {
    backgroundColor: Brand.colors.primary.cyan + '15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.colors.primary.cyan + '30',
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  comingSoonEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.colors.primary.cyan,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
})
