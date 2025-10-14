import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Dimensions, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import { loadNotifications, sortNotificationsByDate, type StoredNotification } from '@/services/notification-storage'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')
const CARD_MAX_WIDTH = 420
const CARD_HEIGHT = Math.min(320, Math.max(360, screenHeight * 0.56))

export default function OnboardingScreen() {
  const { user, loading } = useAuth()
  const { t, language, locale } = useSettings()
  const [index, setIndex] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(true)
  const [forceShow, setForceShow] = useState(false)
  const [notifPreview, setNotifPreview] = useState<StoredNotification[]>([])
  const params = useLocalSearchParams()
  useEffect(() => {
    (async () => {
      try {
        // Only show onboarding if explicitly forced (after signup) or currently active
        const raw = (params as any)?.first
        const first = Array.isArray(raw) ? raw[0] : raw
        const force = await AsyncStorage.getItem('@finora:forceOnboarding')
        const active = await AsyncStorage.getItem('@finora:onboardingActive')
        
        // Only force if explicitly set after signup or coming from signup flow
        const shouldForce = force === '1' || (first && (first === '1' || first === 'true' || first === 'yes'))
        
        // If onboarding is marked active, keep it visible until completion
        if (active === '1' || shouldForce) {
          try {
            // Mark active to persist across re-mounts during initial setup
            await AsyncStorage.setItem('@finora:onboardingActive', '1')
            if (force === '1') await AsyncStorage.removeItem('@finora:forceOnboarding')
          } catch {}
          setForceShow(true)
          setChecking(false)
          return
        }
        
        // Prefer server-side persisted flag (user metadata)
        const seenServer = (user as any)?.user_metadata?.onboarding_seen === true
        if (seenServer) {
          router.replace('/(tabs)')
          return
        }
        
        // Fallback to local flag
        const seen = await AsyncStorage.getItem('@finora:onboardingSeen')
        if (seen) {
          router.replace('/(tabs)')
          return
        }
        
        // If no explicit flags and no completion status, redirect to home
        // (don't show onboarding for existing users who haven't seen it)
        router.replace('/(tabs)')
      } catch {}
      setChecking(false)
    })()
  }, [params])

  const pages = useMemo(
    () => [
      {
        key: 'welcome',
        emoji: '🏛️',
        title: t('welcome_title'),
        subtitle: t('welcome_subtitle')
      },
      {
        key: 'tracking',
        emoji: '📊',
        title: t('tracking_title'),
        subtitle: t('tracking_subtitle')
      },
      {
        key: 'insights',
        emoji: '💡',
        title: t('insights_title'),
        subtitle: t('insights_subtitle')
      },
      {
        key: 'background',
        emoji: '⚙️',
        title: t('background_title'),
        subtitle:
          t('background_subtitle')
      },
      {
        key: 'notifications',
        emoji: '🔔',
        title: t('notifications_title'),
        subtitle: t('notifications_subtitle')
      },
      {
        key: 'confirm',
        emoji: '✅',
        title: t('confirm_title'),
        subtitle: t('confirm_subtitle')
      }
    ],
    []
  )

  const onScrollListener = (e: any) => {
    const x = e.nativeEvent.contentOffset.x
    const i = Math.round(x / screenWidth)
    if (i !== index) setIndex(i)
  }

  const goToIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(pages.length - 1, i))
    scrollRef.current?.scrollTo({ x: clamped * screenWidth, animated: true })
    setIndex(clamped)
  }

  const goNext = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) } catch {}
    if (index < pages.length - 1) {
      goToIndex(index + 1)
    }
  }

  const goBack = () => {
    if (index > 0) goToIndex(index - 1)
  }

  const complete = async () => {
    try {
      setSaving(true)
      // Persist completion to user metadata for cross-device consistency
      try {
        await supabase.auth.updateUser({ data: { onboarding_seen: true } })
      } catch {}
      // Keep local fallback for safety
      try {
        await AsyncStorage.setItem('@finora:onboardingSeen', '1')
      } catch {}
      try { await AsyncStorage.removeItem('@finora:onboardingActive') } catch {}
      router.replace('/(tabs)')
    } finally {
      setSaving(false)
    }
  }

  const openNotificationSettings = async () => {
    try {
      console.log('[Onboarding] 🔔 Opening notification settings...')
      // Try to open notification settings directly
      // apri le impostazioni
      await Linking.openSettings()
    } catch (error) {
      console.log('[Onboarding] ⚠️ Could not open notification settings directly, opening general settings')
      try {
        // Fallback to general app settings
        await Linking.openSettings()
      } catch (fallbackError) {
        console.log('[Onboarding] ❌ Could not open any settings:', fallbackError)
      }
    }
  }

  // Load a small preview of recent notifications (top 5)
  useEffect(() => {
    let timer: any
    const loadPreview = async () => {
      try {
        const all = await loadNotifications()
        const sorted = sortNotificationsByDate(all)
        setNotifPreview(sorted.slice(0, 1))
      } catch {}
    }
    // initial load
    loadPreview()
    // refresh periodically while on onboarding (lightweight)
    timer = setInterval(loadPreview, 3000)
    return () => clearInterval(timer)
  }, [])

  if (loading || checking || (!user && !forceShow)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#06b6d4" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={onScrollListener}
        scrollEventThrottle={16}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {pages.map((p) => (
          <View key={p.key} style={{ width: screenWidth, paddingHorizontal: 28 }}>
            <View style={styles.pageCenter}>
              {/* Recent notifications preview shown at the top on confirm page */}
              {p.key === 'confirm' && (
                <View style={{ width: '100%', alignItems: 'center', marginBottom: 14 }}>
                  <Card style={[styles.previewCard, { maxWidth: CARD_MAX_WIDTH, width: '100%' }]}>
                    <ThemedText type="label" style={styles.previewTitle}>{t('recent_notifications')}</ThemedText>
                    {notifPreview.length === 0 ? (
                      <ThemedText style={styles.previewEmpty}>{t('no_notifications_yet')}</ThemedText>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {notifPreview.map((n) => (
                          <View key={n.id} style={styles.previewItem}>
                            <View style={styles.previewDot} />
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.previewItemTitle} numberOfLines={1}>{n.title}</ThemedText>
                              <ThemedText style={styles.previewItemText} numberOfLines={1}>{n.text}</ThemedText>
                            </View>
                            <ThemedText style={styles.previewTime}>{new Date(n.receivedAt).toLocaleTimeString(locale || (language === 'it' ? 'it-IT' : 'en-US'), { hour: '2-digit', minute: '2-digit' })}</ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                </View>
              )}
              <Card style={[styles.card, { height: CARD_HEIGHT, maxWidth: CARD_MAX_WIDTH }]}>
                <LinearGradient
                  colors={[
                    'rgba(6,182,212,0.10)',
                    'rgba(139,92,246,0.06)',
                    'transparent'
                  ]}
                  style={styles.gradient}
                />
                <View style={styles.emojiWrap}>
                  <ThemedText style={styles.emoji}>{p.emoji}</ThemedText>
                </View>
                <ThemedText style={styles.title}>{p.title}</ThemedText>
                <ThemedText style={styles.subtitle}>{p.subtitle}</ThemedText>
                <View style={{ height: 8 }} />
              </Card>
              <View style={[styles.localBottom, { maxWidth: CARD_MAX_WIDTH }] }>
                <View style={styles.dotsRow}>
                  {pages.map((_, i) => (
                    <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                  ))}
                </View>
                <View style={styles.navRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) } catch {}
                      if (index === pages.length - 1) {
                        complete()
                      } else {
                        goBack()
                      }
                    }}
                    disabled={saving || (index === 0 && pages.length > 1)}
                    style={[styles.backBtn, (saving || (index === 0 && pages.length > 1)) && styles.btnDisabled]}
                  >
                    <ThemedText style={styles.backText}>
                      {index === pages.length - 1 ? (language === 'it' ? 'Chiudi' : 'Close') : t('back')}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (index === pages.length - 1) {
                        openNotificationSettings()
                      } else {
                        goNext()
                      }
                    }}
                    disabled={saving}
                    style={styles.nextBtn}
                  >
                    <LinearGradient
                      colors={[ 'rgba(6,182,212,0.35)', 'rgba(6,182,212,0.22)' ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.nextGradient}
                    >
                      <ThemedText style={styles.nextText}>
                        {index === pages.length - 1 ? t('open_settings') : t('next')}
                      </ThemedText>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f'
  },
  card: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 12,
    paddingVertical: 34,
    paddingHorizontal: 26,
    overflow: 'visible',
    alignItems: 'center',
    // soft shadow/glow
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    alignSelf: 'center',
    width: '100%'
  },
  pageCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 190
  },
  emojiWrap: {
    width: 84,
    height: 84,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,182,212,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    marginBottom: 18,
    paddingTop: 2
  },
  emoji: {
    fontSize: 36,
    lineHeight: 40,
    textAlign: 'center'
  },
  title: {
    color: '#E8EEF8',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 10,
    textAlign: 'center'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 30,
    textAlign: 'center'
  },
  // notifications preview styles
  previewCard: {
    backgroundColor: 'rgba(6,182,212,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.18)',
    borderRadius: 12,
    padding: 12,
  },
  previewTitle: {
    color: '#E8EEF8',
    marginBottom: 10,
    fontWeight: '700'
  },
  previewEmpty: {
    opacity: 0.7,
    textAlign: 'center'
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#06b6d4'
  },
  previewItemTitle: {
    fontWeight: '700',
    color: '#E8EEF8',
    marginBottom: 2
  },
  previewItemText: {
    opacity: 0.8,
    fontSize: 12
  },
  previewTime: {
    fontSize: 10,
    opacity: 0.6,
    marginLeft: 8
  },
  localBottom: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 22,
    paddingHorizontal: 2
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  dotActive: {
    backgroundColor: '#06b6d4'
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  backBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)'
  },
  backText: {
    color: '#E8EEF8',
    fontWeight: '800',
    letterSpacing: 0.3
  },
  nextBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    // soft glow
    shadowColor: '#06b6d4',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  nextGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.45)'
  },
  nextText: {
    color: '#E8EEF8',
    fontWeight: '800',
    letterSpacing: 0.3
  },
  btnDisabled: {
    opacity: 0.5
  }
})


