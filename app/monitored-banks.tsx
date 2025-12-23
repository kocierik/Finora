import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useSettings } from '@/context/SettingsContext'
import { AVAILABLE_BANKS, loadMonitoredBanks, saveMonitoredBanks } from '@/services/bank-preferences'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'

export default function MonitoredBanksScreen() {
  const { language } = useSettings()
  const [selectedBanks, setSelectedBanks] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      const banks = await loadMonitoredBanks()
      setSelectedBanks(banks)
    } catch (error) {
      console.error('Error loading bank preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    try {
      setSaving(true)
      await saveMonitoredBanks(selectedBanks)
      router.back()
    } catch (error) {
      console.error('Error saving bank preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleBank = (bankId: string) => {
    setSelectedBanks(prev => {
      if (prev.includes(bankId)) {
        return prev.filter(id => id !== bankId)
      } else {
        return [...prev, bankId]
      }
    })
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
            {language === 'it' ? 'Banche Monitorate' : 'Monitored Banks'}
          </ThemedText>
          <View style={{ width: 36 }} />
        </View>

        {/* Description Card */}
        <Card style={[styles.descriptionCard, styles.glassCard]}>
          <LinearGradient
            colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.glassCardGradient}
            pointerEvents="none"
          />
          <ThemedText style={styles.descriptionText}>
            {language === 'it' 
              ? 'Seleziona le banche di cui vuoi monitorare le notifiche di pagamento. Finora rileverà automaticamente le spese dalle notifiche selezionate.'
              : 'Select the banks whose payment notifications you want to monitor. Finora will automatically detect expenses from the selected notifications.'}
          </ThemedText>
        </Card>

        {/* Banks List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Brand.colors.primary.cyan} />
          </View>
        ) : (
          <View style={styles.banksList}>
            {AVAILABLE_BANKS.map((bank) => {
              const isSelected = selectedBanks.includes(bank.id)
              return (
                <Pressable
                  key={bank.id}
                  style={[
                    styles.bankItem,
                    isSelected && styles.bankItemSelected
                  ]}
                  onPress={() => toggleBank(bank.id)}
                >
                  <LinearGradient
                    colors={[Brand.colors.primary.teal, Brand.colors.glass.heavy, Brand.colors.glass.heavy]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bankItemGradient}
                    pointerEvents="none"
                  />
                  <View style={styles.bankItemContent}>
                    <View style={styles.bankIcon}>
                      <ThemedText style={styles.bankIconText}>{bank.icon}</ThemedText>
                    </View>
                    <View style={styles.bankInfo}>
                      <ThemedText style={styles.bankName}>{bank.name}</ThemedText>
                      <ThemedText style={styles.bankPackages}>
                        {bank.packageNames.join(', ')}
                      </ThemedText>
                    </View>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && (
                        <ThemedText style={styles.checkboxCheck}>✓</ThemedText>
                      )}
                    </View>
                  </View>
                </Pressable>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Fixed Save Button */}
      <View style={styles.fixedButtonContainer}>
        <Pressable 
          style={[
            styles.saveButton,
            (saving || selectedBanks.length === 0) && styles.saveButtonDisabled
          ]}
          onPress={savePreferences}
          disabled={saving || selectedBanks.length === 0}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Brand.colors.background.deep} />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {language === 'it' ? 'Salva' : 'Save'}
            </ThemedText>
          )}
        </Pressable>
      </View>
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
    paddingBottom: 100, // Extra padding per il bottone fixed
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
  descriptionCard: {
    marginBottom: 24,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    borderRadius: 16,
  },
  glassCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    borderRadius: 16,
  },
  glassCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  descriptionText: {
    opacity: 0.8,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banksList: {
    gap: 12,
    marginBottom: 24,
  },
  bankItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.colors.glass.heavy,
    backgroundColor: UI_CONSTANTS.GLASS_BG,
    overflow: 'hidden',
    position: 'relative',
  },
  bankItemSelected: {
    borderColor: Brand.colors.primary.cyan,
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
  },
  bankItemGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },
  bankItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  bankIcon: {
    width: 48,
    height: 48,
    borderRadius: 24, // Cerchio perfetto (metà della larghezza)
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankIconText: {
    fontSize: 24,
    lineHeight: 30,
  },
  bankInfo: {
    flex: 1,
    gap: 4,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.colors.text.primary,
  },
  bankPackages: {
    fontSize: 11,
    color: Brand.colors.text.secondary,
    opacity: 0.7,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: Brand.colors.primary.cyan,
    backgroundColor: Brand.colors.primary.cyan,
  },
  checkboxCheck: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.colors.background.deep,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    backgroundColor: Brand.colors.primary.cyan,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Brand.colors.background.deep,
    fontWeight: '700',
    fontSize: 16,
  },
})

