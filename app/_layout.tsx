import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Ensure headless listener is always registered (not only when app/index.tsx loads)
import '../headless-notification-listener';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDatabaseSync } from '@/hooks/use-database-sync';
import { setupCategoryReminderChannel } from '@/services/category-reminder';
import { setupDeepLinkNotificationHandler } from '@/services/deep-link-notifications';
import { syncPendingExpenses, syncPendingIncomes } from '@/services/expense-sync';
import { setupInteractiveNotificationChannel, setupNotificationResponseHandler } from '@/services/interactive-notifications';
import { cleanOldNotifications } from '@/services/notification-storage';
import { useWalletListener } from '@/services/wallet-listener';
import { startWeeklyReminderScheduler } from '@/services/weekly-reminder-scheduler';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SettingsProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </SettingsProvider>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth()
  
  // Always call hooks unconditionally - wallet listener handles user check internally
  useWalletListener()
  
  // Sync settings with database
  useDatabaseSync()
  
  // Setup notification channels and handlers
  React.useEffect(() => {
    setupCategoryReminderChannel()
    setupInteractiveNotificationChannel()
    setupNotificationResponseHandler()
    setupDeepLinkNotificationHandler()
  }, [])
  
  // Start weekly reminder scheduler
  React.useEffect(() => {
    startWeeklyReminderScheduler()
  }, [])
  
  // Sync pending expenses when user is authenticated
  React.useEffect(() => {
    if (user) {
      const syncExpenses = async () => {
        try {
          const result = await syncPendingExpenses(user.id)
          if (result.synced > 0) {
            console.log(`[RootNavigator] ✅ Synced ${result.synced} pending expenses`)
          }
        } catch (error) {
          console.warn('[RootNavigator] Failed to sync pending expenses:', error)
        }
      }
      
      const syncIncomes = async () => {
        try {
          const result = await syncPendingIncomes(user.id)
          if (result.synced > 0) {
            console.log(`[RootNavigator] ✅ Synced ${result.synced} pending incomes`)
          }
        } catch (error) {
          console.warn('[RootNavigator] Failed to sync pending incomes:', error)
        }
      }
      
      const cleanOldCache = async () => {
        try {
          // Clean old notifications (older than 15 days)
          await cleanOldNotifications()
        } catch (error) {
          console.warn('[RootNavigator] Failed to clean old notifications:', error)
        }
      }
      
      // Sync immediately when user is authenticated
      syncExpenses()
      syncIncomes()
      cleanOldCache()
      
      // Also sync every 30 seconds while app is active
      const interval = setInterval(() => {
        syncExpenses()
        syncIncomes()
        // Clean old cache every 5 minutes (300000 ms)
      }, 30000)
      
      // Clean old cache every 5 minutes
      const cacheCleanupInterval = setInterval(cleanOldCache, 300000)
      
      // Sync immediately when a new expense is saved (from headless task)
      const expenseSavedSubscription = DeviceEventEmitter.addListener('expense:saved', () => {
        console.log('[RootNavigator] 🎯 New expense saved, syncing immediately...')
        syncExpenses()
      })
      
      // Sync immediately when a new income is saved (from headless task)
      const incomeSavedSubscription = DeviceEventEmitter.addListener('income:saved', () => {
        console.log('[RootNavigator] 🎯 New income saved, syncing immediately...')
        syncIncomes()
      })
      
      return () => {
        clearInterval(interval)
        clearInterval(cacheCleanupInterval)
        expenseSavedSubscription.remove()
        incomeSavedSubscription.remove()
      }
    }
  }, [user])
  
  // console.log('[RootNavigator] 🔄 Auth state:', { user: !!user, loading })
  
  if (loading) return null
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="auth/welcome" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/signup" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="auth/index" />
      <Stack.Screen name="expo-development-client" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="finora-wrapped" />
      <Stack.Screen name="monitored-banks" />
    </Stack>
  )
}
