import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'
import { ThemedText } from '../themed-text'

type LogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  variant?: 'default' | 'minimal' | 'glow'
}

const sizeMap = {
  sm: { container: 40, text: 14 },
  md: { container: 56, text: 18 },
  lg: { container: 72, text: 24 },
  xl: { container: 96, text: 32 },
}

/**
 * Finora Logo Component
 * 
 * A minimalistic wallet/coin shaped logo with:
 * - Circular base (represents a coin)
 * - Gradient from cyan to teal
 * - "F" lettermark for Finora
 * - Optional glow effect
 */
export function Logo({ size = 'md', showText = false, variant = 'default' }: LogoProps) {
  const dimensions = sizeMap[size]
  const hasGlow = variant === 'glow'

  return (
    <View style={styles.container}>
      {/* Logo Circle with Gradient */}
      <View 
        style={[
          styles.logoCircle,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: dimensions.container / 2,
          },
          hasGlow && styles.glowContainer,
        ]}
      >
        <LinearGradient
          colors={['#06b6d4', '#14b8a6', '#22d3ee']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            {
              borderRadius: dimensions.container / 2,
            },
          ]}
        >
          {/* Lettermark "F" */}
          <ThemedText
            style={[
              styles.lettermark,
              {
                fontSize: dimensions.text,
                lineHeight: dimensions.text * 1.2,
              },
            ]}
          >
            F
          </ThemedText>

          {/* Accent Dot (coin detail) */}
          <View
            style={[
              styles.accentDot,
              {
                width: dimensions.container * 0.15,
                height: dimensions.container * 0.15,
                borderRadius: dimensions.container * 0.075,
                top: dimensions.container * 0.25,
                right: dimensions.container * 0.25,
              },
            ]}
          />
        </LinearGradient>

        {/* Glow effect overlay */}
        {hasGlow && (
          <View
            style={[
              styles.glowOverlay,
              {
                width: dimensions.container,
                height: dimensions.container,
                borderRadius: dimensions.container / 2,
              },
            ]}
          />
        )}
      </View>

      {/* Brand Name */}
      {showText && (
        <View style={styles.textContainer}>
          <ThemedText style={styles.brandName}>finora</ThemedText>
          <ThemedText style={styles.tagline}>Your Financial Future</ThemedText>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lettermark: {
    color: '#0a0a0f',
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  accentDot: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  glowContainer: {
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  glowOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    top: 0,
    left: 0,
  },
  textContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})

