import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'
import { Alert, Button, StyleSheet, TextInput, View } from 'react-native'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSignIn = async () => {
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) Alert.alert('Sign in error', error)
  }

  const onSignUp = async () => {
    setLoading(true)
    const { error } = await signUp(email.trim(), password)
    setLoading(false)
    if (error) Alert.alert('Sign up error', error)
    else Alert.alert('Check your email to confirm your account')
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Finora</ThemedText>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#6b7280"
        selectionColor="#ffffff"
        cursorColor="#ffffff"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        selectionColor="#ffffff"
        cursorColor="#ffffff"
        autoComplete="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.row}>
        <Button title={loading ? '...' : 'Sign In'} onPress={onSignIn} disabled={loading} />
        <View style={{ width: 12 }} />
        <Button title={loading ? '...' : 'Sign Up'} onPress={onSignUp} disabled={loading} />
      </View>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  input: { borderWidth: 1, borderColor: '#333', padding: 12, borderRadius: 8, color: '#ffffff', backgroundColor: '#0f1216' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
})


