import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import * as Notifications from 'expo-notifications'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Dimensions, Linking, Platform, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import type { NotificationData } from '@/services/notification-service'
import { checkNotificationPermission, type NotificationPermissionStatus } from '@/services/notification-service'
import { loadNotifications, saveNotification, sortNotificationsByDate, type StoredNotification } from '@/services/notifications/storage'

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
  const [notifReadStatus, setNotifReadStatus] = useState<NotificationPermissionStatus>('unknown')
  const sessionStartRef = useRef<number>(Date.now())
  const permissionIntervalRef = useRef<any>(null)
  const previewIntervalRef = useRef<any>(null)
  const previewTimeoutRef = useRef<any>(null)
  const params = useLocalSearchParams()

  const getSafeTimestamp = (n: any): number => {
    const receivedAt = typeof n?.receivedAt === 'number' ? n.receivedAt : Number(n?.receivedAt)
    if (!isNaN(receivedAt) && receivedAt > 0) return receivedAt
    const ts = typeof n?.timestamp === 'number' ? n.timestamp : Number(n?.timestamp)
    if (!isNaN(ts) && ts > 0) return ts
    return 0
  }
  useEffect(() => {
    // Ensure local notifications can show alerts when app is foreground
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        })
      })
    } catch {}

    (async () => {
      try {
        // Check Android notification-read permission at mount
        try {
          const status = await checkNotificationPermission()
          setNotifReadStatus(status)
        } catch {}

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

  // Pages configuration (depends on translations)
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
        key: 'notifications',
        emoji: '🔔',
        title: t('notifications_title'),
        subtitle: t('notifications_subtitle')
      },
      {
        key: 'background',
        emoji: '⚙️',
        title: t('background_title'),
        subtitle:
          t('background_subtitle')
      },
      {
        key: 'confirm',
        emoji: '✅',
        title: t('confirm_title'),
        subtitle: t('confirm_subtitle')
      }
    ],
    [t]
  )

  // Periodically re-check permission only while on the confirm page
  useEffect(() => {
    // clear any existing interval first
    if (permissionIntervalRef.current) {
      clearInterval(permissionIntervalRef.current)
      permissionIntervalRef.current = null
    }
    let active = true
    const poll = async () => {
      try {
        const status = await checkNotificationPermission()
        if (!active) return
        // update only if still on last page
        if (index === pages.length - 1) {
          setNotifReadStatus(status)
        }
      } catch {}
    }
    if (index === pages.length - 1) {
      permissionIntervalRef.current = setInterval(poll, 3000)
    }
    return () => {
      active = false
      if (permissionIntervalRef.current) {
        clearInterval(permissionIntervalRef.current)
        permissionIntervalRef.current = null
      }
    }
  }, [index, pages.length])

  

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
      await Linking.openSettings()
    } catch (error) {
      try {
        // Fallback to general app settings
        await Linking.openSettings()
      } catch (fallbackError) {
      }
    }
  }

  const sendTestNotification = async () => {
    // Haptics feedback (non-blocking)
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) } catch {}

    // Ensure Android notification channel exists before scheduling
    if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: Brand.colors.primary.cyan
          })
        } catch {}
      }

    // Request/verify permissions first
    let granted = false
    try {
      const current = await Notifications.getPermissionsAsync()
      if (current.status === 'granted') {
        granted = true
      } else {
        const req = await Notifications.requestPermissionsAsync()
        granted = req.status === 'granted'
      }
    } catch {
      // If permission APIs fail, do not attempt to schedule
      granted = false
    }

    // Update read-notifications permission snapshot (used for preview save)
    try {
      const status = await checkNotificationPermission()
      setNotifReadStatus(status)
      } catch {}

    // Schedule only if permissions granted
    if (granted) {
      try {
      await Notifications.scheduleNotificationAsync({
        content: {
            title: t('test_notif_title') || '🎉 Hello!', // Aggiunta icona
            body: t('test_notif_body') || 'Can you see me inside the Finora app?',
          subtitle: 'Finora',
        },
        trigger: null
      })
      } catch {}
    }

      // Persist synthetic entry only if permission is authorized
      if (notifReadStatus === 'authorized') {
        try {
          const now = Date.now()
          const synthetic: NotificationData = {
            id: `finora-test-${now}`,
            app: 'Finora',
          title: t('test_notif_title') || 'Hello!',
          text: t('test_notif_body') || 'Can you see me inside the Finora app?',
            time: new Date(now).toISOString(),
            timestamp: now
          }
          await saveNotification(synthetic)
        } catch {}
      }

    // Toast feedback (best-effort)
      if (Platform.OS === 'android') {
      try { ToastAndroid.show(t('notification_sent') || 'Notification sent', ToastAndroid.SHORT) } catch {}
      }

      // Give the system a short moment to deliver, then refresh preview (only Finora/test notif)
    try {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
        previewTimeoutRef.current = null
      }
      previewTimeoutRef.current = setTimeout(async () => {
        try {
          // avoid running if we left the last page
          if (index !== pages.length - 1) return
        const all = await loadNotifications()
        const sorted = sortNotificationsByDate(all)
        const onlyTest = sorted.filter(n => {
          const isAppTest = (n.app || '').toLowerCase().includes('finora') || n.title === t('test_notif_title')
            const ts = getSafeTimestamp(n)
            const isCurrentSession = ts > 0 ? ts >= sessionStartRef.current : true
          return isAppTest && isCurrentSession
        })
        setNotifPreview(onlyTest.slice(0, 1))
        } catch {}
      }, 600)
    } catch {}
  }

  // Load a small preview of recent notifications (top 1) only on confirm page
  useEffect(() => {
    // when leaving the final page, clear preview to avoid rendering stale data
    if (index !== pages.length - 1 && notifPreview.length > 0) {
      setNotifPreview([])
    }
    // clear any existing interval/timeout first
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current)
      previewIntervalRef.current = null
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
    }
    let active = true
    const loadPreview = async () => {
      try {
        const all = await loadNotifications()
        if (!active) return
        const sorted = sortNotificationsByDate(all)
        const onlyTest = sorted.filter(n => {
          const isAppTest = (n.app || '').toLowerCase().includes('finora') || n.title === t('test_notif_title')
          const ts = getSafeTimestamp(n)
          const isCurrentSession = ts > 0 ? ts >= sessionStartRef.current : true
          return isAppTest && isCurrentSession
        })
        // set only if still on last page
        if (index === pages.length - 1) {
        setNotifPreview(onlyTest.slice(0, 1))
        }
      } catch {}
    }
    if (index === pages.length - 1) {
    loadPreview()
      previewIntervalRef.current = setInterval(loadPreview, 3000)
    }
    return () => {
      active = false
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current)
        previewIntervalRef.current = null
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
        previewTimeoutRef.current = null
      }
    }
  }, [index, pages.length, t])

  if (loading || checking || (!user && !forceShow)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Brand.colors.primary.cyan} />
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
                      <>
                        <ThemedText style={styles.previewEmpty}>{t('no_notifications_yet')}</ThemedText>
                      </>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {notifPreview.map((n) => (
                          <View key={n.id} style={styles.previewItem}>
                            <View style={styles.previewDot} />
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.previewItemTitle} numberOfLines={1}>{n.title || t('no_title')}</ThemedText>
                              <ThemedText style={styles.previewItemText} numberOfLines={1}>{n.text || t('no_text')}</ThemedText>
                            </View>
                          <ThemedText style={styles.previewTime}>{
                            (() => {
                              const ts = typeof n.receivedAt === 'number' ? n.receivedAt : (typeof (n as any).timestamp === 'number' ? (n as any).timestamp : undefined)
                              if (!ts) return '--:--'
                              const d = new Date(ts)
                              if (isNaN(d.getTime())) return '--:--'
                              try {
                                return d.toLocaleTimeString(locale || (language === 'it' ? 'it-IT' : 'en-US'), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              } catch {
                                return '--:--'
                              }
                            })()
                          }</ThemedText>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={{ height: 10 }} />
                    <Pressable accessibilityRole="button" onPress={sendTestNotification} style={styles.testBtn}>
                      <ThemedText style={styles.backText}>{t('try_send_test')}</ThemedText>
                    </Pressable>
                  </Card>
                </View>
              )}
              <Card style={[styles.card, { height: CARD_HEIGHT, maxWidth: CARD_MAX_WIDTH }]}>
                <LinearGradient
                  colors={UI_CONSTANTS.GRADIENT_CYAN_BG_CARD as any}
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
                      colors={UI_CONSTANTS.GRADIENT_CYAN_BUTTON as any}
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
    backgroundColor: Brand.colors.background.deep
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.colors.background.deep
  },
  card: {
    backgroundColor: UI_CONSTANTS.GLASS_BG_XS,
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
    backgroundColor: UI_CONSTANTS.ACCENT_CYAN_BG,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER,
    marginBottom: 18,
    paddingTop: 2
  },
  emoji: {
    fontSize: 36,
    lineHeight: 40,
    textAlign: 'center'
  },
  title: {
    color: Brand.colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 10,
    textAlign: 'center'
  },
  subtitle: {
    color: Brand.colors.text.secondary,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 30,
    textAlign: 'center'
  },
  // notifications preview styles
  previewCard: {
    backgroundColor: UI_CONSTANTS.GLASS_BG_MD,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
    borderRadius: 12,
    padding: 12,
  },
  previewTitle: {
    color: Brand.colors.text.primary,
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
    backgroundColor: Brand.colors.primary.cyan
  },
  previewItemTitle: {
    fontWeight: '700',
    color: Brand.colors.text.primary,
    marginBottom: 2
  },
  previewItemText: {
    opacity: 0.8,
    fontSize: 12,
    color: Brand.colors.text.secondary
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
    backgroundColor: UI_CONSTANTS.GLASS_BORDER
  },
  dotActive: {
    backgroundColor: Brand.colors.primary.cyan
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
    borderColor: UI_CONSTANTS.GLASS_BORDER,
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM
  },
  backText: {
    color: Brand.colors.text.primary,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  nextBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    // soft glow
    shadowColor: Brand.colors.primary.cyan,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  nextGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.ACCENT_CYAN_BORDER
  },
  nextText: {
    color: Brand.colors.text.primary,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  btnDisabled: {
    opacity: 0.5
  },
  testBtn: {
    alignSelf: 'center',
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: UI_CONSTANTS.GLASS_BORDER,
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM
  }
})


