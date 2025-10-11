import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { Logo } from '@/components/ui/Logo'
import { Brand } from '@/constants/branding'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'

export default function ProfileScreen() {
  const { user, signOut, loading: authLoading } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [loading, setLoading] = useState(false)

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
      const { data } = await supabase.from('profiles').select('display_name,currency').eq('id', user.id).maybeSingle()
      if (data) {
        setDisplayName(data.display_name ?? '')
        setCurrency(data.currency ?? 'EUR')
      }
    })()
  }, [user?.id])

  const save = async () => {
    if (!user) return
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: displayName, currency })
    setLoading(false)
    if (error) Alert.alert('Errore', error.message)
    else Alert.alert('Profilo aggiornato')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Brand Identity Header */}
      <View style={styles.brandHeader}>
        <LinearGradient
          colors={['rgba(6, 182, 212, 0.1)', 'transparent']}
          style={styles.brandGradient}
        />
        <Logo size="lg" variant="glow" />
        <View style={styles.brandInfo}>
          <ThemedText style={styles.brandName}>{Brand.name}</ThemedText>
          <ThemedText style={styles.tagline}>{Brand.tagline}</ThemedText>
        </View>
        <View style={styles.versionBadge}>
          <ThemedText style={styles.versionText}>v1.0.0</ThemedText>
        </View>
      </View>

      {/* User Info Card */}
      <Card style={styles.card} glow="rgba(6, 182, 212, 0.1)">
        <View style={styles.cardHeader}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>👤 Informazioni Utente</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText style={styles.value}>{user?.email}</ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <ThemedText style={styles.label}>ID Utente</ThemedText>
          <ThemedText style={styles.valueSmall}>{user?.id.slice(0, 8)}...</ThemedText>
        </View>
      </Card>

      {/* Settings Card */}
      <Card style={styles.card} glow="rgba(20, 184, 166, 0.1)">
        <View style={styles.cardHeader}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>⚙️ Impostazioni</ThemedText>
        </View>
        <View style={{ gap: 16 }}>
          <View>
            <ThemedText style={styles.label}>Nome visualizzato</ThemedText>
            <TextInput 
              style={styles.input} 
              value={displayName} 
              onChangeText={setDisplayName} 
              placeholder="Il tuo nome"
              placeholderTextColor={Brand.colors.text.muted}
            />
          </View>
          <View>
            <ThemedText style={styles.label}>Valuta predefinita</ThemedText>
            <TextInput 
              style={styles.input} 
              value={currency} 
              onChangeText={setCurrency} 
              placeholder="EUR"
              placeholderTextColor={Brand.colors.text.muted}
            />
          </View>
          <Pressable 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={save} 
            disabled={loading}
          >
            <LinearGradient
              colors={[Brand.colors.primary.cyan, Brand.colors.primary.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              <ThemedText style={styles.saveButtonText}>
                {loading ? 'Salvataggio...' : 'Salva modifiche'}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Card>

      {/* About Card */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText type="defaultSemiBold" style={styles.cardTitle}>ℹ️ Informazioni</ThemedText>
        </View>
        <View style={styles.aboutContent}>
          <ThemedText style={styles.aboutText}>
            {Brand.name} è la tua app di gestione finanziaria personale. Monitora investimenti, 
            spese e transazioni in un'unica soluzione elegante e sicura.
          </ThemedText>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <ThemedText style={styles.featureIcon}>💎</ThemedText>
              <ThemedText style={styles.featureText}>Tracciamento portafoglio in tempo reale</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <ThemedText style={styles.featureIcon}>💳</ThemedText>
              <ThemedText style={styles.featureText}>Monitoraggio spese automatico</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <ThemedText style={styles.featureIcon}>📊</ThemedText>
              <ThemedText style={styles.featureText}>Analytics dettagliati</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <ThemedText style={styles.featureIcon}>🔐</ThemedText>
              <ThemedText style={styles.featureText}>Sicurezza enterprise-grade</ThemedText>
            </View>
          </View>
        </View>
      </Card>

      {/* Logout Button */}
      <Pressable 
        style={styles.logoutButton} 
        onPress={async () => {
          try {
            setLoading(true)
            await signOut()
            // The AuthContext should handle redirect automatically
            console.log('[Profile] ✅ Logout completed, redirecting...')
          } catch (error) {
            console.error('[Profile] ❌ Logout failed:', error)
            Alert.alert('Errore', 'Impossibile effettuare il logout. Riprova.')
          } finally {
            setLoading(false)
          }
        }}
        disabled={loading}
      >
        <ThemedText style={styles.logoutButtonText}>
          {loading ? '⏳ Uscita...' : '🚪 Esci'}
        </ThemedText>
      </Pressable>

      {/* Footer */}
      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>Made with ❤️ for your financial future</ThemedText>
        <ThemedText style={styles.footerCopyright}>© 2025 {Brand.name}</ThemedText>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
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
  brandInfo: {
    alignItems: 'center',
    marginTop: 16,
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
  card: {
    marginBottom: 16,
    padding: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
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
})


