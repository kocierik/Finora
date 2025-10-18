import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Ensure headless listener is always registered (not only when app/index.tsx loads)
import '../headless-notification-listener';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDatabaseSync } from '@/hooks/use-database-sync';
import { useWalletListener } from '@/services/wallet-listener';

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
    </Stack>
  )
}
