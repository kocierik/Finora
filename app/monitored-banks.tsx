import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { useSettings } from '@/context/SettingsContext'
import { AVAILABLE_BANKS, loadMonitoredBanks, saveMonitoredBanks } from '@/services/bank-preferences'
import { router } from 'expo-router'
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
        <Card style={styles.descriptionCard}>
          <ThemedText style={styles.descriptionText}>
            {language === 'it' 
              ? 'Seleziona le banche di cui vuoi monitorare le notifiche di pagamento. Finora rileverà automaticamente le spese dalle notifiche selezionate.'
              : 'Select the banks whose payment notifications you want to monitor. Finora will automatically detect expenses from the selected notifications.'}
          </ThemedText>
        </Card>

        {/* Banks List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#06b6d4" />
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
            <ActivityIndicator size="small" color="#0a0a0f" />
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
    backgroundColor: '#0a0a0f',
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  bankItemSelected: {
    borderColor: 'rgba(6,182,212,0.5)',
    backgroundColor: 'rgba(6,182,212,0.1)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#06b6d4',
    backgroundColor: '#06b6d4',
  },
  checkboxCheck: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0f',
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButton: {
    backgroundColor: '#06b6d4',
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
    color: '#0a0a0f',
    fontWeight: '700',
    fontSize: 16,
  },
})

