import { ThemedText } from '@/components/themed-text'
import { Brand, UI as UI_CONSTANTS } from '@/constants/branding'
import { Card } from '@/components/ui/Card'
import { DEFAULT_CATEGORY_COLOR } from '@/constants/categories'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { calculateWrappedData, WrappedData } from '@/services/wrapped-analytics'
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient'
import * as Sharing from 'expo-sharing'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Vibration,
  View
} from 'react-native'
import ViewShot from 'react-native-view-shot'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

// Animated Counter Component
const AnimatedCounter = ({
  value,
  duration = 2000,
  style,
  currencyCode = 'EUR',
  locale = 'it-IT',
}: {
  value: number
  duration?: number
  style?: any
  currencyCode?: string
  locale?: string
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()

    const listener = animatedValue.addListener(({ value: currentValue }) => {
      setDisplayValue(Math.round(currentValue))
    })

    return () => {
      animatedValue.removeListener(listener)
    }
  }, [value, duration])

  return (
    <Animated.Text style={style}>
      {displayValue.toLocaleString(locale, { style: 'currency', currency: currencyCode })}
    </Animated.Text>
  )
}

// Progress Bar Component
const ProgressBar = ({ percentage, color, animated = true }: { percentage: number; color: string; animated?: boolean }) => {
  const progressAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: percentage,
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start()
    } else {
      progressAnim.setValue(percentage)
    }
  }, [percentage, animated])

  return (
    <View style={styles.progressBarContainer}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: color,
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  )
}

// Loading Dots Component
const LoadingDots = () => {
  const dot1Anim = useRef(new Animated.Value(0.4)).current
  const dot2Anim = useRef(new Animated.Value(0.7)).current
  const dot3Anim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(dot1Anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(dot2Anim, {
              toValue: 0.4,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(dot3Anim, {
              toValue: 0.7,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(dot1Anim, {
              toValue: 0.7,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(dot2Anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(dot3Anim, {
              toValue: 0.4,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(dot1Anim, {
              toValue: 0.4,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(dot2Anim, {
              toValue: 0.7,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(dot3Anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start()
    }

    animateDots()
  }, [])

  return (
    <View style={styles.loadingDots}>
      <Animated.View style={[styles.loadingDot, { opacity: dot1Anim }]} />
      <Animated.View style={[styles.loadingDot, { opacity: dot2Anim }]} />
      <Animated.View style={[styles.loadingDot, { opacity: dot3Anim }]} />
    </View>
  )
}

// Floating Particle Component
const FloatingParticle = ({ delay = 0, color = DEFAULT_CATEGORY_COLOR }: { delay?: number; color?: string }) => {
  const floatAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animate = () => {
      Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: 1,
              duration: 3000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 3000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: 2000,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start()
    }

    const timer = setTimeout(animate, delay)
    return () => clearTimeout(timer)
  }, [delay])

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  })

  return (
    <Animated.View
      style={[
        styles.floatingParticle,
        {
          backgroundColor: color,
          opacity: opacityAnim,
          transform: [{ translateY }],
        },
      ]}
    />
  )
}

export default function FinoraWrappedScreen() {
  const { user } = useAuth()
  const { language, locale, currency } = useSettings()
  const [currentPage, setCurrentPage] = useState(0)
  const [data, setData] = useState<WrappedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const backgroundAnim = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const loadingIconScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Load user data
    const loadUserData = async () => {
      if (!user?.id) return
      
      try {
        setIsLoading(true)
        const wrappedData = await calculateWrappedData(user.id)
        setData(wrappedData)
      } catch (error) {
        console.error('Error loading wrapped data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [user?.id])

  // Loading icon animation
  useEffect(() => {
    if (isLoading) {
      const animateIcon = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(loadingIconScale, {
              toValue: 1.1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(loadingIconScale, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start()
      }
      animateIcon()
    }
  }, [isLoading])

  useEffect(() => {
    if (!data) return

    // Enhanced initial animation sequence
    setIsAnimating(true)
    
    Animated.sequence([
      // Background fade in
      Animated.timing(backgroundAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Main content animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
      ])
    ]).start(() => {
      setIsAnimating(false)
    })
  }, [data])

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x
    const pageIndex = Math.min(Math.round(contentOffsetX / screenWidth), 4) // Max 5 pages (0-4)
    
    if (pageIndex !== currentPage) {
      // Haptic feedback on page change
      if (Platform.OS === 'ios') {
        Vibration.vibrate(50)
      } else {
        Vibration.vibrate(100)
      }
    setCurrentPage(pageIndex)
    }
  }

  const handleShare = async () => {
    if (!data) return
    
    try {
      const fmt = (n: number) => n.toLocaleString(locale, { style: 'currency', currency })
      const message = language === 'it'
        ? `Ecco il mio Finora Wrapped ${new Date().getFullYear()} 💎\n\nEntrate totali: ${fmt(data.totalIncome)}\nSpese totali: ${fmt(data.totalExpenses)}\nRisparmi: ${fmt(data.savings)} (${data.savingsRate.toFixed(1)}%)\n\nSto costruendo il mio futuro finanziario, una scelta alla volta 💎\n\n#FinoraWrapped`
        : `Check out my Finora Wrapped ${new Date().getFullYear()} 💎\n\nTotal Income: ${fmt(data.totalIncome)}\nTotal Spent: ${fmt(data.totalExpenses)}\nSaved: ${fmt(data.savings)} (${data.savingsRate.toFixed(1)}%)\n\nBuilding my financial story, one smart move at a time 💎\n\n#FinoraWrapped`
      
      await Share.share({
        message,
        title: `My Finora Wrapped ${new Date().getFullYear()}`
      })
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <View style={styles.loadingScreen}>
        <ExpoLinearGradient
          colors={[Brand.colors.background.deep, Brand.colors.background.card, Brand.colors.background.deep]}
          style={styles.loadingGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.loadingContent}>
          <Animated.View style={[styles.loadingIconContainer, { transform: [{ scale: loadingIconScale }] }]}>
            <ThemedText style={styles.loadingIcon}>💎</ThemedText>
          </Animated.View>
          <ThemedText style={styles.loadingTitle}>Finora Wrapped</ThemedText>
          <ThemedText style={styles.loadingText}>
            {language === 'it' ? 'Prepariamo il tuo riepilogo…' : 'Preparing your recap…'}
          </ThemedText>
          <LoadingDots />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Enhanced gradient background */}
      <Animated.View 
        style={[
          styles.backgroundGradient,
          { opacity: backgroundAnim }
        ]}
      >
        <ExpoLinearGradient
          colors={[Brand.colors.background.deep, Brand.colors.background.card, Brand.colors.background.deep]}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {/* Floating particles */}

      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ]
          }
        ]}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          <IntroPage language={language} />
          <SpendingStoryPage data={data} locale={locale} currency={currency} language={language} />
          <EarningsJourneyPage data={data} locale={locale} currency={currency} language={language} />
          <BalanceEvolutionPage data={data} locale={locale} currency={currency} language={language} />
          <FinalSummaryPage data={data} onShare={handleShare} locale={locale} currency={currency} language={language} />
        </ScrollView>
      </Animated.View>

      {/* Enhanced page indicators */}
      <View style={styles.pageIndicators}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.indicator,
              { 
                opacity: index === currentPage ? 1 : 0.3,
                transform: [{ scale: index === currentPage ? 1.2 : 1 }]
              }
            ]}
          />
        ))}
      </View>
    </View>
  )
}

// Intro Page Component
const IntroPage = ({ language }: { language: string }) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.introContent}>
      <ThemedText style={{ fontSize: 64, marginBottom: 12, textAlign: 'center', lineHeight: 72 }}>💎</ThemedText>
        <ThemedText style={styles.introTitle}>
          {language === 'it' ? `Il tuo ${new Date().getFullYear()}\nFinora Wrapped` : `Your ${new Date().getFullYear()}\nFinora Wrapped`}
        </ThemedText>
        
        <ThemedText style={styles.introSubtitle}>
          {language === 'it'
            ? 'Un viaggio tra spese, risparmi e progresso.'
            : 'A journey through your spending, saving, and growth.'}
        </ThemedText>

        <View style={styles.scrollHint}>
          <ThemedText style={styles.scrollHintText}>
            {language === 'it' ? 'Scorri per iniziare →' : 'Swipe to explore →'}
          </ThemedText>
        </View>
      </View>
    </View>
  )
}

// Spending Story Page Component
const SpendingStoryPage = ({ data, locale, currency, language }: any) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          {language === 'it' ? 'Le tue spese nel 2025 💳' : 'You spent this year 💳'}
        </ThemedText>
      </View>

      <View style={styles.spendingContent}>
        <View style={styles.largeNumberContainer}>
          <AnimatedCounter 
            value={data.totalExpenses} 
            style={styles.largeNumber}
            duration={2500}
            currencyCode={currency}
            locale={locale}
          />
          <ThemedText style={styles.largeNumberLabel}>
            {language === 'it' ? 'Spese totali' : 'Total expenses'}
          </ThemedText>
        </View>

        <View style={styles.categoryList}>
          {data.categoryData && data.categoryData.length > 0 ? (
            data.categoryData.map((category: { name: string; amount: number; color: string; percentage: number }, index: number) => (
              <Card key={index} variant="subtle" style={[styles.categoryCardHorizontal, { borderColor: `${DEFAULT_CATEGORY_COLOR}40` }]}>
                <View style={styles.categoryCardContent}>
                  <View style={[styles.categoryColor, { backgroundColor: DEFAULT_CATEGORY_COLOR }]} />
                  <ThemedText style={styles.categoryName} numberOfLines={1}>{category.name}</ThemedText>
                  <ThemedText style={styles.categoryAmount} numberOfLines={1}>
                    {category.amount.toLocaleString(locale, { style: 'currency', currency })}
                  </ThemedText>
                  <ThemedText style={styles.categoryPercentage}>{category.percentage.toFixed(1)}%</ThemedText>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { 
                      width: `${category.percentage}%`,
                      backgroundColor: DEFAULT_CATEGORY_COLOR
                    }]} />
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.noDataContainer}>
              <ThemedText style={styles.noDataText}>
                {language === 'it' ? 'Nessun dato spese' : 'No expense data available'}
              </ThemedText>
              <ThemedText style={styles.noDataSubtext}>
                {language === 'it'
                  ? 'Inizia a registrare le spese per vedere insight.'
                  : 'Start tracking your expenses to see insights.'}
              </ThemedText>
            </View>
          )}
        </View>

        <Card variant="subtle" style={styles.insightCard}>
          <ThemedText style={styles.insightText}>
            {language === 'it'
              ? `Hai speso di più in ${data.topCategory}.`
              : `Most spent on ${data.topCategory}.`}
          </ThemedText>
        </Card>
      </View>
    </View>
  )
}

// Earnings Journey Page Component
const EarningsJourneyPage = ({ data, locale, currency, language }: any) => {
  const totalIncome = data.monthlyBalances.reduce((sum: number, month: any) => sum + (month.income || 0), 0)
  const monthsWithIncome = data.monthlyBalances.filter((month: any) => (month.income || 0) > 0)
  const averageMonthlyIncome = monthsWithIncome.length > 0
    ? totalIncome / monthsWithIncome.length
    : 0

  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          {language === 'it' ? 'Il tuo percorso di entrate 💼' : 'Your earning journey 💼'}
        </ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          {language === 'it' ? 'Costruendo valore, mese dopo mese' : 'Building wealth, one month at a time'}
        </ThemedText>
      </View>

      <View style={styles.earningsContent}>
        {/* Income Overview Cards */}
        <View style={styles.earningsOverviewGrid}>
          <Card variant="subtle" style={styles.earningsOverviewCard}>
            <ThemedText style={styles.earningsOverviewLabel} numberOfLines={1} ellipsizeMode="tail">
              {language === 'it' ? 'Entrate totali' : 'Total income'}
            </ThemedText>
            <AnimatedCounter 
              value={totalIncome} 
              style={styles.earningsOverviewValue}
              duration={2500}
              currencyCode={currency}
              locale={locale}
            />
          </Card>

          <Card variant="subtle" style={styles.earningsOverviewCard}>
            <ThemedText style={styles.earningsOverviewLabel} numberOfLines={1} ellipsizeMode="tail">
              {language === 'it' ? 'Media mensile' : 'Avg. monthly'}
            </ThemedText>
            <AnimatedCounter 
              value={averageMonthlyIncome} 
              style={styles.earningsOverviewValue}
              duration={2500}
              currencyCode={currency}
              locale={locale}
            />
          </Card>
          
          <Card variant="subtle" style={styles.earningsOverviewCard}>
            <ThemedText style={styles.earningsOverviewLabel} numberOfLines={1} ellipsizeMode="tail">
              {language === 'it' ? 'Crescita' : 'Growth'}
            </ThemedText>
            <ThemedText style={[styles.earningsOverviewGrowth, { color: data.incomeGrowth >= 0 ? '#4ade80' : '#f87171' }]}>
              {data.incomeGrowth >= 0 ? '+' : ''}{data.incomeGrowth.toFixed(1)}%
          </ThemedText>
          </Card>
        </View>

        {/* Monthly Income Chart */}
        <View style={styles.monthlyEarningsContainer}>
          <ThemedText style={styles.monthlyEarningsTitle}>
            {language === 'it' ? 'Trend entrate mensili' : 'Monthly income trend'}
          </ThemedText>
          <View style={styles.monthlyEarningsGrid}>
            {data.monthlyBalances.map((month: any, index: number) => (
              <Card key={month.monthNumber} variant="subtle" style={[styles.monthlyEarningsCardCompact, { 
                borderColor: month.income > 0 ? `${DEFAULT_CATEGORY_COLOR}40` : 'rgba(255, 255, 255, 0.1)',
                opacity: month.income > 0 ? 1 : 0.6
              }]}>
                <ThemedText style={styles.monthlyEarningsMonthCompact}>{month.month}</ThemedText>
                <AnimatedCounter 
                  value={month.income} 
                  style={styles.monthlyEarningsAmountCompact}
                  duration={1500}
                  currencyCode={currency}
                  locale={locale}
                />
                <View style={styles.monthlyEarningsBarCompact}>
                  <View style={[styles.monthlyEarningsBarFillCompact, { 
                    width: month.income > 0 ? `${Math.min((month.income / Math.max(...data.monthlyBalances.map((m: any) => m.income))) * 100, 100)}%` : '0%',
                    backgroundColor: month.income > 0 ? DEFAULT_CATEGORY_COLOR : 'rgba(255, 255, 255, 0.1)'
                  }]} />
              </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Earnings Insight */}
        <Card variant="subtle" style={styles.earningsInsight}>
          <ThemedText style={styles.earningsInsightText}>
            {monthsWithIncome.length > 0 
              ? (language === 'it'
                  ? `📊 Hai entrate registrate per ${monthsWithIncome.length} mesi`
                  : `📊 You have income data for ${monthsWithIncome.length} months`)
              : (language === 'it'
                  ? '📊 Inizia a registrare le entrate per vedere insight'
                  : '📊 Start tracking your income to see your journey')
            }
          </ThemedText>
        </Card>
      </View>
    </View>
  )
}

// Balance Evolution Page Component
const BalanceEvolutionPage = ({ data, locale, currency, language }: any) => {
  // Only count months where we have BOTH income and expenses (> 0)
  const countedMonths = (data.monthlyBalances || []).filter((m: any) => (m?.income || 0) > 0 && (m?.expenses || 0) > 0)

  const startingBalance = countedMonths[0]?.balance || 0
  const currentBalance = countedMonths[countedMonths.length - 1]?.balance || 0
  const balanceGrowth = startingBalance > 0 ? ((currentBalance - startingBalance) / startingBalance) * 100 : 0
  const totalGrowth = currentBalance - startingBalance
  
  const averageMonthlyFlow = countedMonths.length > 0 
    ? countedMonths.reduce((sum: number, month: any) => sum + (month.balance || 0), 0) / countedMonths.length 
    : 0

  const bestMonth = countedMonths.length > 0
    ? countedMonths.reduce((max: any, month: any) => (month.balance > max.balance ? month : max))
    : null

  const maxBalance = countedMonths.length > 0 ? Math.max(...countedMonths.map((m: any) => m.balance || 0)) : 0

  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          {language === 'it' ? 'Evoluzione cash flow 📈' : 'Cash flow evolution 📈'}
        </ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          {language === 'it' ? 'Entrate vs spese, mese dopo mese' : 'Income vs expenses, month by month'}
        </ThemedText>
      </View>

      <View style={styles.balanceContent}>

        {/* Detailed Cash Flow Stats */}
        <View style={styles.balanceStatsContainer}>
          <Card variant="subtle" style={styles.balanceStatCard}>
            <ThemedText style={styles.balanceStatLabel} numberOfLines={1} ellipsizeMode="tail">
              {language === 'it' ? 'Mese migliore' : 'Best month'}
            </ThemedText>
            <ThemedText style={styles.balanceStatValue}>
              {bestMonth?.month || '—'}
            </ThemedText>
            <ThemedText style={styles.balanceStatAmount}>
              {(bestMonth?.balance || 0).toLocaleString(locale, { style: 'currency', currency })}
            </ThemedText>
          </Card>
          
          <Card variant="subtle" style={styles.balanceStatCard}>
            <ThemedText style={styles.balanceStatLabel} numberOfLines={1} ellipsizeMode="tail">
              {language === 'it' ? 'Media mensile' : 'Avg. monthly'}
            </ThemedText>
            <ThemedText style={styles.balanceStatValue}>
              {averageMonthlyFlow.toLocaleString(locale, { style: 'currency', currency })}
            </ThemedText>
          </Card>
        </View>

        {/* Compact Monthly Chart */}
        <View style={styles.balanceChartContainer}>
          <ThemedText style={styles.balanceChartTitle}>
            {language === 'it' ? 'Trend cash flow mensile' : 'Monthly cash flow trend'}
          </ThemedText>
          <View style={styles.balanceChartCompact}>
            {countedMonths.length === 0 ? (
              <ThemedText style={[styles.noDataSubtext, { textAlign: 'center', width: '100%' }]}>
                {language === 'it' ? 'Nessun mese con entrate e spese' : 'No months with both income and expenses'}
              </ThemedText>
            ) : (
              countedMonths.map((month: any) => {
                const heightPercentage = maxBalance > 0 ? ((month.balance || 0) / maxBalance) * 100 : 0

                return (
                  <View key={month.monthNumber} style={styles.balanceChartItemCompact}>
                    <View style={styles.balanceChartBarCompact}>
                      <View style={[styles.balanceChartBarFillCompact, { 
                        height: `${Math.max(heightPercentage, 8)}%`,
                        backgroundColor: DEFAULT_CATEGORY_COLOR,
                        opacity: 1
                      }]} />
                    </View>
                    <ThemedText style={styles.balanceChartMonthCompact}>{month.month}</ThemedText>
                  </View>
                )
              })
            )}
          </View>
        </View>

        {/* Growth Insights */}
        <Card variant="subtle" style={styles.balanceInsight}>
          <ThemedText style={styles.balanceInsightText}>
            {totalGrowth >= 0 ? '💰' : '📉'}{' '}
            {totalGrowth >= 0
              ? (language === 'it' ? 'Cash flow positivo: ottimo lavoro!' : 'Positive cash flow: great job!')
              : (language === 'it' ? 'Obiettivo 2026: aumenta entrate o riduci spese.' : 'Goal: increase income or reduce expenses.')}
          </ThemedText>
        </Card>
      </View>
    </View>
  )
}

// Instagram Share Component (identical to final page but without buttons)
const InstagramShareView = ({ data, locale, currency, language }: any) => {
  const totalIncome = data.monthlyBalances.reduce((sum: number, month: any) => sum + month.income, 0)
  const totalExpenses = data.totalExpenses
  const savings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0
  
  // Find top category amount
  const topCategoryAmount = data.categoryBreakdown?.find((cat: any) => cat.name === data.topCategory)?.amount || 0

  return (
    <View style={styles.instagramContainer}>
      <ExpoLinearGradient
        colors={[Brand.colors.background.deep, Brand.colors.background.card, Brand.colors.background.deep]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <View style={styles.instagramPageHeader}>
        <ThemedText style={styles.instagramPageTitle}>
          {language === 'it' ? '🎉 Il tuo percorso finanziario' : '🎉 Your financial journey'}
        </ThemedText>
        <ThemedText style={styles.instagramPageSubtitle}>
          {language === 'it'
            ? 'Scelte smart. Progressi reali. Futuro più sereno.'
            : 'Smart moves. Strong progress. Brighter future.'}
        </ThemedText>
      </View>

      <View style={styles.instagramSummaryContent}>
        {/* Main Stats */}
        <View style={styles.instagramMainStatsContainer}>
          <View style={styles.instagramMainStatCard}>
            <ThemedText style={styles.instagramMainStatIcon}>💰</ThemedText>
            <ThemedText style={styles.instagramMainStatLabel}>{language === 'it' ? 'Entrate' : 'Income'}</ThemedText>
            <AnimatedCounter 
              value={totalIncome} 
              style={styles.instagramMainStatValue}
              duration={2500}
              currencyCode={currency}
              locale={locale}
            />
          </View>
          
          <View style={styles.instagramMainStatCard}>
            <ThemedText style={styles.instagramMainStatIcon}>💳</ThemedText>
            <ThemedText style={styles.instagramMainStatLabel}>{language === 'it' ? 'Spese' : 'Spent'}</ThemedText>
            <AnimatedCounter 
              value={totalExpenses} 
              style={styles.instagramMainStatValue}
              duration={2500}
              currencyCode={currency}
              locale={locale}
            />
          </View>
        </View>
        
        {/* Savings Highlight */}
        <View style={styles.instagramSavingsHighlight}>
          <ThemedText style={styles.instagramSavingsIcon}>💎</ThemedText>
          <ThemedText style={styles.instagramSavingsLabel}>{language === 'it' ? 'Risparmi' : 'You saved'}</ThemedText>
          <AnimatedCounter 
            value={savings} 
            style={styles.instagramSavingsValue}
            duration={2500}
            currencyCode={currency}
            locale={locale}
          />
          <ThemedText style={styles.instagramSavingsRate}>
            {language === 'it' ? `${savingsRate.toFixed(1)}% delle entrate` : `${savingsRate.toFixed(1)}% of your income`}
          </ThemedText>
        </View>

        {/* Top Achievement */}
        <View style={styles.instagramTopAchievement}>
          <ThemedText style={styles.instagramAchievementIcon}>🏆</ThemedText>
          <ThemedText style={styles.instagramAchievementText}>
            {language === 'it' ? 'Top categoria: ' : 'Top category: '}
            <ThemedText style={styles.instagramAchievementHighlight}>{data.topCategory}</ThemedText>
          </ThemedText>
          <AnimatedCounter 
            value={topCategoryAmount} 
            style={styles.instagramAchievementAmount}
            duration={2500}
            currencyCode={currency}
            locale={locale}
          />
        </View>

        {/* Brand Message */}
        <View style={styles.instagramBrandMessage}>
          <ThemedText style={styles.instagramBrandText}>
            Powered by Finora 
          </ThemedText>
        </View>
      </View>
    </View>
  )
}

// Final Summary Page Component
const FinalSummaryPage = ({ data, onShare, locale, currency, language }: any) => {
  const totalIncome = data.monthlyBalances.reduce((sum: number, month: any) => sum + month.income, 0)
  const totalExpenses = data.totalExpenses
  const savings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0
  
  // Find top category amount
  const topCategoryAmount = data.categoryBreakdown?.find((cat: any) => cat.name === data.topCategory)?.amount || 0

  const viewShotRef = useRef<ViewShot | null>(null)
  const [isSharing, setIsSharing] = useState(false)

  const hapticTap = () => {
    // Simple haptic feedback without extra deps
    if (Platform.OS === 'ios') Vibration.vibrate(30)
    else Vibration.vibrate(50)
  }

  const handleInstagramShare = async () => {
    try {
      setIsSharing(true)
      
      if (!viewShotRef.current) return

      // Capture the view as an image
      const captureMethod = viewShotRef.current.capture
      if (!captureMethod) {
        Alert.alert('Error', 'Capture method not available')
        return
      }
      const uri = await captureMethod()
      if (!uri) {
        Alert.alert('Error', 'Failed to capture image')
        return
      }
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device')
        return
      }

      // Share the image
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your Finora Wrapped on Instagram',
        UTI: 'public.png'
      })

    } catch (error) {
      console.error('Error sharing image:', error)
      Alert.alert('Error', 'Failed to generate and share image. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const handleDownload = async () => {
    try {
      await onShare()
      Alert.alert(language === 'it' ? 'Fatto' : 'Done', language === 'it' ? 'Riepilogo condiviso.' : 'Summary shared.')
    } catch (error) {
      console.error('Download error:', error)
      Alert.alert(language === 'it' ? 'Errore' : 'Error', language === 'it' ? 'Impossibile condividere. Riprova.' : 'Failed to share. Please try again.')
    }
  }

  return (
    <>
      {/* Hidden Instagram Share View for capturing */}
      <View style={styles.hiddenView}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <InstagramShareView data={data} locale={locale} currency={currency} language={language} />
        </ViewShot>
      </View>

      {/* Main visible page */}
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
            {language === 'it' ? `🎉 Il tuo ${new Date().getFullYear()} in Finora` : `🎉 Your ${new Date().getFullYear()} in Finora`}
        </ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          {language === 'it'
            ? 'Scelte smart. Progressi reali. Futuro più sereno.'
            : 'Smart moves. Strong progress. Brighter future.'}
        </ThemedText>
      </View>

      <View style={styles.summaryContent}>
          {/* Main Stats - Instagram Ready */}
          <View style={styles.mainStatsContainer}>
            <Card variant="subtle" style={styles.mainStatCard}>
              <ThemedText style={styles.mainStatIcon}>💰</ThemedText>
              <ThemedText style={styles.mainStatLabel}>{language === 'it' ? 'Entrate' : 'Income'}</ThemedText>
              <AnimatedCounter 
                value={totalIncome} 
                style={styles.mainStatValue}
                duration={2500}
                currencyCode={currency}
                locale={locale}
              />
            </Card>
          
            <Card variant="subtle" style={styles.mainStatCard}>
              <ThemedText style={styles.mainStatIcon}>💳</ThemedText>
              <ThemedText style={styles.mainStatLabel}>{language === 'it' ? 'Spese' : 'Spent'}</ThemedText>
              <AnimatedCounter 
                value={totalExpenses} 
                style={styles.mainStatValue}
                duration={2500}
                currencyCode={currency}
                locale={locale}
              />
            </Card>
          </View>
          
          {/* Savings Highlight */}
          <Card variant="subtle" style={styles.savingsHighlight}>
            <ThemedText style={styles.savingsIcon}>💎</ThemedText>
            <ThemedText style={styles.savingsLabel}>{language === 'it' ? 'Risparmi' : 'You saved'}</ThemedText>
            <AnimatedCounter 
              value={savings} 
              style={styles.savingsValue}
              duration={2500}
              currencyCode={currency}
              locale={locale}
            />
            <ThemedText style={styles.savingsRate}>
              {language === 'it' ? `${savingsRate.toFixed(1)}% delle entrate` : `${savingsRate.toFixed(1)}% of your income`}
            </ThemedText>
          </Card>

          {/* Top Achievement */}
          <Card variant="subtle" style={styles.topAchievement}>
            <ThemedText style={styles.achievementIcon}>🏆</ThemedText>
            <ThemedText style={styles.achievementText}>
              {language === 'it' ? 'Top categoria: ' : 'Top category: '}
              <ThemedText style={styles.achievementHighlight}>{data.topCategory}</ThemedText>
            </ThemedText>
            <AnimatedCounter 
              value={topCategoryAmount} 
              style={styles.achievementAmount}
              duration={2500}
              currencyCode={currency}
              locale={locale}
            />
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <Pressable
              onPress={handleInstagramShare}
              disabled={isSharing}
              style={({ pressed }) => [
                styles.finalCtaButton,
                styles.finalCtaPrimary,
                (pressed && !isSharing) && styles.finalCtaPressed,
                isSharing && { opacity: 0.7 }
              ]}
            >
              <ExpoLinearGradient
                colors={[`${DEFAULT_CATEGORY_COLOR}55`, `${DEFAULT_CATEGORY_COLOR}22`, 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.finalCtaGradient}
                pointerEvents="none"
              />
              {isSharing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <ThemedText style={styles.shareButtonText} numberOfLines={1}>Generating...</ThemedText>
                </View>
              ) : (
                <View>
                  <ThemedText style={styles.shareButtonText} numberOfLines={1}>📤</ThemedText>
                  <ThemedText style={styles.shareButtonText} numberOfLines={1}>
                    {language === 'it' ? 'Condividi su Instagram' : 'Share on Instagram'}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          
            <Pressable
              onPress={handleDownload}
              onPressIn={hapticTap}
              style={({ pressed }) => [
                styles.finalCtaButton,
                styles.finalCtaSecondary,
                pressed && styles.finalCtaPressed
              ]}
            >
              <ExpoLinearGradient
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.finalCtaGradient}
                pointerEvents="none"
              />
              <View>
                <ThemedText style={styles.downloadButtonText} numberOfLines={1}>💾</ThemedText>
                <ThemedText style={styles.downloadButtonText} numberOfLines={1}>
                  {language === 'it' ? 'Condividi riepilogo' : 'Share summary'}
                </ThemedText>
              </View>
            </Pressable>
        </View> 

          {/* Brand Message */}
          <View style={styles.brandMessage}>
            <ThemedText style={styles.brandText}>
              Powered by Finora 
            </ThemedText>
      </View>
    </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.colors.background.deep,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBackground: {
    flex: 1,
  },
  floatingParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    top: Math.random() * screenHeight,
    left: Math.random() * screenWidth,
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 10,
  },
  scrollView: {
    flex: 1,
  },
  pageContainer: {
    width: screenWidth,
    flex: 1,
    marginTop: 50,
    justifyContent: 'center',
  },
  pageHeader: {
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  introContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 42,
  },
  introSubtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 40,
    lineHeight: 24,
  },
  scrollHint: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: `${DEFAULT_CATEGORY_COLOR}55`,
  },
  scrollHintText: {
    fontSize: 14,
    color: DEFAULT_CATEGORY_COLOR,
    textAlign: 'center',
    fontWeight: '500',
  },
  ctaButton: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  largeNumberContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  largeNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  largeNumberLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 8,
  },
  categoryList: {
    marginBottom: 30,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    opacity: 0.8,
  },
  categoryCardHorizontal: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryCardLeft: {
    flex: 1,
  },
  categoryCardRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  categoryItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
    marginLeft: 4,
  },
  categoryAmount: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    width: 40,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  monthlyList: {
    marginBottom: 30,
  },
  monthlyScrollView: {
    marginBottom: 30,
  },
  monthlyScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  monthlyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 120,
  },
  monthlyName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginRight: 8,
  },
  monthlyIncome: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  monthlyBalance: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  balanceStat: {
    alignItems: 'center',
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightCardWithGap: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ade80',
    textAlign: 'center',
  },
  insightIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  insightTextContainer: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 6,
    lineHeight: 18,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  growthHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    alignItems: 'center',
  },
  growthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  mainStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  mainStatCard: {
    flex: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  mainStatIcon: {
    fontSize: 24,
  },
  mainStatLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  mainStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  savingsHighlight: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.5)',
  },
  savingsIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 6,
    fontWeight: '600',
  },
  savingsValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#06b6d4',
    marginBottom: 4,
  },
  savingsRate: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    fontWeight: '600',
  },
  topAchievement: {
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  achievementIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  achievementText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },
  achievementHighlight: {
    fontWeight: '700',
    color: '#06b6d4',
  },
  achievementAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#06b6d4',
    marginTop: 8,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  finalCtaButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: UI_CONSTANTS.GLASS_BG_SM,
  },
  finalCtaPrimary: {
    borderColor: `${DEFAULT_CATEGORY_COLOR}55`,
  },
  finalCtaSecondary: {
    borderColor: UI_CONSTANTS.GLASS_BORDER_MD,
  },
  finalCtaGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
  },
  finalCtaPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.985 }],
  },
  shareButton: {
    flex: 1,
    backgroundColor: 'rgba(6, 181, 212, 0.14)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  downloadButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  brandMessage: {
    alignItems: 'center',
  },
  brandText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  // Instagram Share Styles
  hiddenView: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  instagramContainer: {
    width: 1080,
    height: 1920,
    backgroundColor: Brand.colors.background.deep,
    paddingHorizontal: 30, // Increased padding for better spacing
    paddingTop: 40, // Reduced top padding even more to move title higher
    paddingBottom: 30, // Increased bottom padding
  },
  instagramPageHeader: {
    alignItems: 'center',
//    marginBottom: 200, // Increased margin for better separation
    marginTop: 180, // Increased margin for better separation
    lineHeight: 40,

  },
  instagramPageTitle: {
    fontSize: 72, // Increased from 72 for much better visibility
    fontWeight: '800', // Increased weight for better impact
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 80,

    marginBottom: 24, // Increased margin
  },
  instagramPageSubtitle: {
    fontSize: 44, // Increased from 36
    color: '#FFFFFF',
    lineHeight: 50,
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '600', // Added weight for better visibility
  },
  instagramSummaryContent: {
    flex: 1,
    paddingHorizontal: 50, // Increased horizontal padding for more space from edges
    justifyContent: 'space-between', // Changed from 'center' to distribute space evenly
    paddingVertical: 30, // Increased vertical padding
  },
  instagramMainStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1, // Added flex to use available space
    gap: 24, // Increased gap between cards for better separation
    marginBottom: 20, // Reduced margin since we're using flex
  },
  instagramMainStatCard: {
    flex: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderRadius: 24, // Increased border radius for more modern look
    padding: 48, // Increased uniform padding from 32 (now 48px all around)
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  instagramMainStatIcon: {
    fontSize: 80, // Increased from 64 for much better visibility
    marginBottom: 12, // Optimized margin
    lineHeight: 80,
  },
  instagramMainStatLabel: {
    fontSize: 28, // Increased from 24
    color: '#FFFFFF',
    opacity: 0.9, // Increased opacity for better visibility
    marginBottom: 8, // Reduced margin to bring value closer
    lineHeight: 34, // Optimized line height for single line
    textAlign: 'center',
    fontWeight: '600', // Increased weight for better readability
  },
  instagramMainStatValue: {
    fontSize: 44, // Increased from 36 for much better readability
    fontWeight: '900', // Increased weight for better impact
    color: '#FFFFFF',
    marginTop: 2, // Small margin to separate from label
    marginBottom: 6, // Small margin to separate from label
    padding: 4,
  },
  instagramSavingsHighlight: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderRadius: 28, // Increased border radius for more modern look
    padding: 40, // Increased padding for more space
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    flex: 2, // Added flex to use more space (2x the main stats)
    borderWidth: 3,
    borderColor: 'rgba(6, 182, 212, 0.5)',
    marginVertical: 20, // Added vertical margin for spacing
  },
  instagramSavingsIcon: {
    fontSize: 96, // Increased from 72 for much better visibility
    marginBottom: 20, // Increased margin
    lineHeight: 80,

  },
  instagramSavingsLabel: {
    fontSize: 36, // Increased from 28
    color: '#FFFFFF',
    opacity: 0.95, // Increased opacity for better visibility
    marginBottom: 16, // Increased margin
    fontWeight: '700', // Increased weight for better readability
    lineHeight: 80,

  },
  instagramSavingsValue: {
    fontSize: 72, // Increased from 56 for much better readability
    fontWeight: '900',
    color: '#06b6d4',
    marginBottom: 12, // Increased margin
  },
  instagramSavingsRate: {
    fontSize: 32, // Increased from 24
    color: '#FFFFFF',
    opacity: 0.85, // Increased opacity for better visibility
    fontWeight: '700', // Increased weight for better readability
  },
  instagramTopAchievement: {
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    borderRadius: 20, // Increased border radius for more modern look
    padding: 32, // Increased padding for more space
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    flex: 1.5, // Added flex to use space (1.5x the main stats)
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    marginVertical: 20, // Added vertical margin for spacing
  },
  instagramAchievementIcon: {
    fontSize: 64, // Increased from 48 for much better visibility
    marginBottom: 20, // Increased margin
    lineHeight: 80,

  },
  instagramAchievementText: {
    fontSize: 32, // Increased from 24
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38, // Increased line height for better readability
    fontWeight: '600', // Added weight for better readability
  },
  instagramAchievementHighlight: {
    fontWeight: '700',
    fontSize: 32, // Increased from 24
    color: '#06b6d4',
  },
  instagramAchievementAmount: {
    fontSize: 48, // Increased from 36 for much better readability
    fontWeight: '900', // Increased weight for better impact
    color: '#06b6d4',
    marginTop: 20, // Increased margin
  },
  instagramBrandMessage: {
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
    flex: 0.5, // Added flex to use remaining space
    paddingVertical: 20, // Added padding for better spacing
  },
  instagramBrandText: {
    fontSize: 28, // Increased from 22 for much better visibility
    color: '#FFFFFF',
    opacity: 0.75, // Increased opacity for better visibility
    fontStyle: 'italic',
    fontWeight: '600', // Added weight for better readability
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 40,
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  spendingContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryScrollView: {
    marginVertical: 20,
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  categoryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 140,
    alignItems: 'center',
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryPercentage: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 35,
    textAlign: 'right',
  },
  earningsContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  earningsOverviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 8,
  },
  earningsOverviewCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  earningsOverviewLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 6,
    textAlign: 'center',
  },
  earningsOverviewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  earningsOverviewGrowth: {
    fontSize: 18,
    fontWeight: '700',
  },
  earningsStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  earningsStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 8,
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  growthValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4ade80',
  },
  growthSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.6,
    marginTop: 4,
  },
  monthlyEarningsContainer: {
    marginBottom: 20,
  },
  monthlyEarningsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  monthlyEarningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthlyEarningsCardCompact: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '22%',
    alignItems: 'center',
  },
  monthlyEarningsMonthCompact: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  monthlyEarningsAmountCompact: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  monthlyEarningsBarCompact: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  monthlyEarningsBarFillCompact: {
    height: '100%',
    borderRadius: 2,
  },
  monthlyEarningsScroll: {
    marginBottom: 20,
  },
  monthlyEarningsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  monthlyEarningsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 100,
    alignItems: 'center',
  },
  monthlyEarningsMonth: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 8,
  },
  monthlyEarningsAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  monthlyEarningsBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  monthlyEarningsBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  earningsInsight: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 22,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  earningsInsightText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  balanceContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: -20,
  },
  balanceSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 8,
  },
  balanceSummaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceSummaryLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 6,
  },
  balanceSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceSummaryGrowth: {
    fontSize: 18,
    fontWeight: '700',
  },
  balanceStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 8,
  },
  balanceStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceStatLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
  },
  balanceStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  balanceStatAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4ade80',
  },
  balanceChartContainer: {
    marginBottom: 30,
  },
  balanceChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  balanceChartCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingHorizontal: 4,
  },
  balanceChartItemCompact: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  balanceChartBarCompact: {
    width: 8,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
    justifyContent: 'flex-end',
  },
  balanceChartBarFillCompact: {
    width: '100%',
    borderRadius: 4,
  },
  balanceChartMonthCompact: {
    fontSize: 8,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  balanceOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  balanceOverviewCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceOverviewLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 8,
    textAlign: 'center',
  },
  balanceOverviewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  balanceGrowthValue: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  balanceChartScroll: {
    marginBottom: 20,
  },
  balanceChartContent: {
    paddingHorizontal: 20,
    gap: 12,
    alignItems: 'flex-end',
  },
  balanceChartItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  balanceChartBar: {
    width: 20,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    justifyContent: 'flex-end',
  },
  balanceChartBarFill: {
    width: '100%',
    borderRadius: 10,
  },
  balanceChartMonth: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 4,
  },
  balanceChartAmount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  balanceInsight: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  balanceInsightText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: Brand.colors.background.deep,
  },
  loadingGradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
  },
  loadingIconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    paddingVertical: 20,
  },
  loadingIcon: {
    fontSize: 80,
    textAlign: 'center',
    lineHeight: 90,
  },
  loadingTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 16,
    letterSpacing: 1,
  },
  loadingText: {
    fontSize: 20,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 50,
    fontWeight: '500',
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DEFAULT_CATEGORY_COLOR,
  },
})