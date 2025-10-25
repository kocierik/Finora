import { ThemedText } from '@/components/themed-text'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import React, { useEffect, useRef, useState } from 'react'
import {
    Animated,
    Dimensions,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View
} from 'react-native'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

interface WrappedData {
  totalExpenses: number
  totalIncome: number
  savings: number
  savingsRate: number
  incomeGrowth: number
  topCategory: string
  topCategoryAmount: number
  monthlyBalances: Array<{ month: string; balance: number; income: number; expenses: number }>
  insights: Array<{ title: string; value: string; icon: string }>
}

// Mock data - in real app, this would come from your database
const mockWrappedData: WrappedData = {
  totalExpenses: 12450,
  totalIncome: 24800,
  savings: 12350,
  savingsRate: 49.8,
  incomeGrowth: 14,
  topCategory: 'Travel',
  topCategoryAmount: 3200,
  monthlyBalances: [
    { month: 'Jan', balance: 1200, income: 2100, expenses: 1800 },
    { month: 'Feb', balance: 1500, income: 2100, expenses: 1700 },
    { month: 'Mar', balance: 1900, income: 2200, expenses: 1800 },
    { month: 'Apr', balance: 2300, income: 2200, expenses: 1600 },
    { month: 'May', balance: 2700, income: 2300, expenses: 1900 },
    { month: 'Jun', balance: 3100, income: 2300, expenses: 1500 },
    { month: 'Jul', balance: 3600, income: 2400, expenses: 1800 },
    { month: 'Aug', balance: 4000, income: 2400, expenses: 2000 },
    { month: 'Sep', balance: 4400, income: 2500, expenses: 2100 },
    { month: 'Oct', balance: 4800, income: 2500, expenses: 1900 },
    { month: 'Nov', balance: 5200, income: 2600, expenses: 2000 },
    { month: 'Dec', balance: 5600, income: 2600, expenses: 1800 }
  ],
  insights: [
    { title: 'Dining expenses reduced by', value: '12%', icon: '🍽️' },
    { title: 'Savings rate increased by', value: '8%', icon: '📊' },
    { title: 'On track to save by mid-2026', value: '€3,200', icon: '💎' }
  ]
}

const categoryData = [
  { name: 'Food', amount: 2800, color: '#00B4D8', percentage: 22.5 },
  { name: 'Travel', amount: 3200, color: '#C084FC', percentage: 25.7 },
  { name: 'Bills', amount: 2400, color: '#06b6d4', percentage: 19.3 },
  { name: 'Entertainment', amount: 1800, color: '#8B5CF6', percentage: 14.5 },
  { name: 'Shopping', amount: 1200, color: '#A855F7', percentage: 9.6 },
  { name: 'Other', amount: 1050, color: '#D8B4FE', percentage: 8.4 }
]

export default function FinoraWrappedScreen() {
  const { user } = useAuth()
  const { t, currency } = useSettings()
  const [currentPage, setCurrentPage] = useState(0)
  const [data] = useState<WrappedData>(mockWrappedData)
  
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const slideAnim = useRef(new Animated.Value(50)).current
  const scrollViewRef = useRef<ScrollView>(null)

  useEffect(() => {
    // Initial animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start()
  }, [])

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x
    const pageIndex = Math.round(contentOffsetX / screenWidth)
    setCurrentPage(pageIndex)
  }

  const handleShare = async () => {
    try {
      const message = `Check out my 2025 Finora Wrapped! 💎\n\nTotal Income: ${currency}${data.totalIncome.toLocaleString()}\nTotal Spent: ${currency}${data.totalExpenses.toLocaleString()}\nSaved: ${currency}${data.savings.toLocaleString()} (${data.savingsRate}%)\n\nBuilding my financial story, one smart move at a time 💎\n\n#FinoraWrapped #FinancialJourney`
      
      await Share.share({
        message,
        title: 'My Finora Wrapped 2025'
      })
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  return (
    <View style={styles.container}>
      {/* Dark theme background */}
      <View style={styles.backgroundDark} />
      
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
          <IntroPage />
          <SpendingStoryPage data={data} />
          <EarningsJourneyPage data={data} />
          <BalanceEvolutionPage data={data} />
          <AIInsightsPage data={data} />
          <FinalSummaryPage data={data} onShare={handleShare} />
        </ScrollView>
      </Animated.View>

      {/* Page indicators */}
      <View style={styles.pageIndicators}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              { opacity: index === currentPage ? 1 : 0.3 }
            ]}
          />
        ))}
      </View>
    </View>
  )
}

// Intro Page Component
const IntroPage = () => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.introContent}>
        <ThemedText style={styles.introTitle}>
          Your 2025{'\n'}Finora Wrapped
        </ThemedText>
        
        <ThemedText style={styles.introSubtitle}>
          A journey through your spending,{'\n'}saving, and growing year.
        </ThemedText>

        <View style={styles.scrollHint}>
          <ThemedText style={styles.scrollHintText}>Swipe to explore →</ThemedText>
        </View>
      </View>
    </View>
  )
}

// Spending Story Page Component
const SpendingStoryPage = ({ data }: any) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          You spent smart this year 💳
        </ThemedText>
      </View>

      <View style={styles.spendingContent}>
        <View style={styles.largeNumberContainer}>
          <ThemedText style={styles.largeNumber}>
            €{data.totalExpenses.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.largeNumberLabel}>total expenses</ThemedText>
        </View>

        <View style={styles.categoryList}>
          {categoryData.slice(0, 4).map((category, index) => (
            <View key={index} style={[styles.categoryItem, { borderColor: category.color + '40' }]}>
              <View style={[styles.categoryColor, { backgroundColor: category.color }]} />
              <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
              <ThemedText style={styles.categoryAmount}>€{category.amount.toLocaleString()}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.insightCard}>
          <ThemedText style={styles.insightText}>
            Most spent on {data.topCategory} ✈️ — good memories count too.
          </ThemedText>
        </View>
      </View>
    </View>
  )
}

// Earnings Journey Page Component
const EarningsJourneyPage = ({ data }: any) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          And you earned it 💼
        </ThemedText>
      </View>

      <View style={styles.earningsContent}>
        <View style={styles.largeNumberContainer}>
          <ThemedText style={styles.largeNumber}>
            €{data.totalIncome.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.largeNumberLabel}>total income</ThemedText>
        </View>

        <View style={styles.growthHighlight}>
          <ThemedText style={styles.growthText}>
            +{data.incomeGrowth}% growth since 2024 🎉
          </ThemedText>
        </View>

        <View style={styles.monthlyList}>
          {data.monthlyBalances.slice(0, 6).map((month: any, index: number) => {
            const colors = ['#00B4D8', '#C084FC', '#06b6d4', '#8B5CF6', '#A855F7', '#D8B4FE']
            return (
              <View key={index} style={[styles.monthlyItem, { borderColor: colors[index] + '40' }]}>
                <ThemedText style={styles.monthlyName}>{month.month}</ThemedText>
                <ThemedText style={styles.monthlyIncome}>€{month.income.toLocaleString()}</ThemedText>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

// Balance Evolution Page Component
const BalanceEvolutionPage = ({ data }: any) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          Your financial balance over time
        </ThemedText>
      </View>

      <View style={styles.balanceContent}>
        <View style={styles.balanceStats}>
          <View style={styles.balanceStat}>
            <ThemedText style={styles.balanceLabel}>Starting Balance</ThemedText>
            <ThemedText style={styles.balanceValue}>€{data.monthlyBalances[0].balance.toLocaleString()}</ThemedText>
          </View>
          <View style={styles.balanceStat}>
            <ThemedText style={styles.balanceLabel}>Current Balance</ThemedText>
            <ThemedText style={styles.balanceValue}>€{data.monthlyBalances[data.monthlyBalances.length - 1].balance.toLocaleString()}</ThemedText>
          </View>
        </View>

        <View style={styles.monthlyList}>
          {data.monthlyBalances.slice(0, 6).map((month: any, index: number) => {
            const colors = ['#00B4D8', '#C084FC', '#06b6d4', '#8B5CF6', '#A855F7', '#D8B4FE']
            return (
              <View key={index} style={[styles.monthlyItem, { borderColor: colors[index] + '40' }]}>
                <ThemedText style={styles.monthlyName}>{month.month}</ThemedText>
                <ThemedText style={styles.monthlyBalance}>€{month.balance.toLocaleString()}</ThemedText>
              </View>
            )
          })}
        </View>

        <View style={styles.insightCard}>
          <ThemedText style={styles.insightText}>
            You managed to save more than you spent for 7 months straight 👏
          </ThemedText>
        </View>
      </View>
    </View>
  )
}

// AI Insights Page Component
const AIInsightsPage = ({ data }: any) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          Finora's take on your future 🔮
        </ThemedText>
      </View>

      <View style={styles.insightsContent}>
        {data.insights.map((insight: any, index: number) => {
          const colors = ['#00B4D8', '#C084FC', '#06b6d4']
          return (
            <Card key={index} style={[styles.insightCard, { borderColor: colors[index] + '40' }]}>
              <View style={styles.insightCardContent}>
                <ThemedText style={styles.insightIcon}>{insight.icon}</ThemedText>
                <View style={styles.insightTextContainer}>
                  <ThemedText style={styles.insightTitle}>{insight.title}</ThemedText>
                  <ThemedText style={styles.insightValue}>{insight.value}</ThemedText>
                </View>
              </View>
            </Card>
          )
        })}
      </View>
    </View>
  )
}

// Final Summary Page Component
const FinalSummaryPage = ({ data, onShare }: any) => {
  return (
    <View style={styles.pageContainer}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>
          Your 2025 Financial Journey
        </ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          Smart moves. Strong progress. Brighter future.
        </ThemedText>
      </View>

      <View style={styles.summaryContent}>
        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Total Income</ThemedText>
            <ThemedText style={styles.summaryValue}>€{data.totalIncome.toLocaleString()}</ThemedText>
          </View>
          
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Total Spent</ThemedText>
            <ThemedText style={styles.summaryValue}>€{data.totalExpenses.toLocaleString()}</ThemedText>
          </View>
          
          <View style={styles.summaryStat}>
            <ThemedText style={styles.summaryLabel}>Saved</ThemedText>
            <ThemedText style={styles.summaryValue}>€{data.savings.toLocaleString()}</ThemedText>
            <ThemedText style={styles.summaryPercentage}>(≈{data.savingsRate}%)</ThemedText>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Pressable style={styles.shareButton} onPress={onShare}>
            <ThemedText style={styles.shareButtonText}>📤 Share Your Wrapped</ThemedText>
          </Pressable>
          
          <Pressable style={styles.downloadButton}>
            <ThemedText style={styles.downloadButtonText}>💾 Download Summary</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  backgroundDark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0f',
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 100,
  },
  scrollView: {
    flex: 1,
  },
  pageContainer: {
    width: screenWidth,
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  pageHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
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
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  scrollHintText: {
    fontSize: 14,
    color: '#06b6d4',
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
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
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
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 4,
    marginRight: 8,
  },
  categoryAmount: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  monthlyList: {
    marginBottom: 30,
  },
  monthlyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
  insightText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 4,
  },
  insightsContent: {
    flex: 1,
    justifyContent: 'center',
  },
  insightCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
    justifyContent: 'center',
  },
  summaryStats: {
    marginBottom: 40,
  },
  summaryStat: {
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.7,
    marginBottom: 12,
    lineHeight: 18,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 38,
  },
  summaryPercentage: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 6,
    lineHeight: 20,
  },
  actionButtons: {
    marginTop: 40,
    gap: 16,
  },
  shareButton: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  downloadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
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
    justifyContent: 'center',
  },
  earningsContent: {
    flex: 1,
    justifyContent: 'center',
  },
  balanceContent: {
    flex: 1,
    justifyContent: 'center',
  },
})