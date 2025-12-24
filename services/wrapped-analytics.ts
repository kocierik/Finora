import { supabase } from '@/lib/supabase'
import { DEFAULT_CATEGORY_COLOR } from '@/constants/categories'

export interface WrappedData {
  totalExpenses: number
  totalIncome: number
  savings: number
  savingsRate: number
  incomeGrowth: number
  topCategory: string
  topCategoryAmount: number
  monthlyBalances: Array<{ month: string; monthNumber: number; balance: number; income: number; expenses: number }>
  insights: Array<{ title: string; value: string; icon: string }>
  categoryData: Array<{ name: string; amount: number; color: string; percentage: number }>
  categoryBreakdown: Array<{ name: string; amount: number; color: string; percentage: number }>
}

export interface CategoryData {
  name: string
  amount: number
  color: string
  percentage: number
}

/**
 * Calculate wrapped data for the current year
 */
export async function calculateWrappedData(userId: string): Promise<WrappedData> {
  try {
    const currentYear = new Date().getFullYear()
    const startOfYear = `${currentYear}-01-01`
    const endOfYear = `${currentYear}-12-31`

    // Fetch expenses for the current year
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        amount,
        date,
        category_id,
        merchant,
        currency
      `)
      .eq('user_id', userId)
      .gte('date', startOfYear)
      .lte('date', endOfYear)
      .order('date', { ascending: true })

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError)
      return getDefaultWrappedData()
    }

    // Calculate total expenses (defensive: treat as absolute)
    const totalExpenses = expenses?.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0) || 0

    // Try to fetch categories table for names and colors
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, color')
      .eq('user_id', userId)

    // Create category lookup map
    const categoryLookup = new Map<string, { name: string; color: string }>()
    if (categories && !categoriesError) {
      categories.forEach(cat => {
        categoryLookup.set(cat.id, { name: cat.name, color: cat.color })
      })
    }

    // Calculate category data using category_id
    const categoryMap = new Map<string, { amount: number; color: string; name: string }>()
    
    expenses?.forEach(expense => {
      if (expense.category_id) {
        const categoryId = expense.category_id
        const categoryInfo = categoryLookup.get(categoryId)
        const existing = categoryMap.get(categoryId) || { 
          amount: 0, 
          color: DEFAULT_CATEGORY_COLOR, 
          name: categoryInfo?.name || `Category ${categoryId}` // Use real name or fallback
        }
        existing.amount += Math.abs(expense.amount || 0)
        categoryMap.set(categoryId, existing)
      }
    })

    // Convert to array and calculate percentages
    const categoryData: CategoryData[] = Array.from(categoryMap.values())
      .map(category => ({
        name: category.name,
        amount: category.amount,
        color: category.color,
        percentage: totalExpenses > 0 ? (category.amount / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    // Get top category
    const topCategory = categoryData.length > 0 ? categoryData[0].name : 'No data'
    const topCategoryAmount = categoryData.length > 0 ? categoryData[0].amount : 0

    // Fetch investments for the current year to calculate portfolio value
    const { data: investments, error: investmentsError } = await supabase
      .from('investments')
      .select(`
        ticker,
        quantity,
        average_price,
        purchase_date
      `)
      .eq('user_id', userId)
      .gte('purchase_date', startOfYear)
      .lte('purchase_date', endOfYear)

    if (investmentsError) {
      console.error('Error fetching investments:', investmentsError)
      // Continue without investments data
    }

    // Fetch incomes for the current year
    const { data: incomes, error: incomesError } = await supabase
      .from('incomes')
      .select(`
        amount,
        date,
        source,
        category,
        currency
      `)
      .eq('user_id', userId)
      .gte('date', startOfYear)
      .lte('date', endOfYear)
      .order('date', { ascending: true })

    if (incomesError) {
      console.error('Error fetching incomes:', incomesError)
      // Continue without incomes data
    }

    // Fetch user profile for monthly income
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('monthly_income, currency')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      // Continue without profile data
    }

    // Calculate total income from real data
    const totalIncome = calculateTotalIncome(incomes || [], profile?.monthly_income, expenses || [])

    // Calculate monthly data with real income
    const monthlyData = calculateMonthlyData(expenses || [], investments || [], incomes || [], profile?.monthly_income, currentYear)

    // Calculate savings
    const savings = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0

    // Calculate income growth (compare with previous year)
    const previousYearIncome = await calculatePreviousYearIncome(userId, currentYear - 1)
    const incomeGrowth = previousYearIncome > 0 ? ((totalIncome - previousYearIncome) / previousYearIncome) * 100 : 0

    // Generate insights
    const insights = generateInsights(categoryData, savingsRate, totalExpenses, totalIncome)

    return {
      totalExpenses,
      totalIncome,
      savings,
      savingsRate,
      incomeGrowth,
      topCategory,
      topCategoryAmount,
      monthlyBalances: monthlyData,
      insights,
      categoryData,
      categoryBreakdown: categoryData
    }
  } catch (error) {
    console.error('Error calculating wrapped data:', error)
    return getDefaultWrappedData()
  }
}

/**
 * Calculate total income from various sources
 */
function calculateTotalIncome(incomes: any[], monthlyIncome: number | null, expenses: any[]): number {
  // 1. Sum all detailed incomes
  const detailedIncome = incomes.reduce((sum, income) => sum + income.amount, 0)
  
  // 2. Add annual income from profile (monthly * 12)
  const profileAnnualIncome = monthlyIncome ? monthlyIncome * 12 : 0
  
  // 3. If we have real income data, use it
  if (detailedIncome > 0 || profileAnnualIncome > 0) {
    return detailedIncome + profileAnnualIncome
  }
  
  // 4. No fallback estimation - return 0 if no real income data
  return 0
}

/**
 * Calculate monthly data for the year - include all months with real or simulated data
 */
function calculateMonthlyData(expenses: any[], investments: any[], incomes: any[], monthlyIncome: number | null, year: number) {
  const monthlyData = []
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  // Calculate average expense per month for simulation
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const averageMonthlyExpense = totalExpenses > 0 ? totalExpenses / 12 : 0
  
  // Calculate total investment value
  const totalInvestmentValue = investments.reduce((sum, investment) => 
    sum + (investment.quantity * investment.average_price), 0)
  
  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    
    const monthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date)
      return expenseDate >= monthStart && expenseDate <= monthEnd
    })

    const monthInvestments = investments.filter(investment => {
      const investmentDate = new Date(investment.purchase_date)
      return investmentDate >= monthStart && investmentDate <= monthEnd
    })

    const monthIncomes = incomes.filter(income => {
      const incomeDate = new Date(income.date)
      return incomeDate >= monthStart && incomeDate <= monthEnd
    })

    const monthExpenseTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const monthInvestmentTotal = monthInvestments.reduce((sum, investment) => 
      sum + (investment.quantity * investment.average_price), 0)
    const monthIncomeTotal = monthIncomes.reduce((sum, income) => sum + income.amount, 0)
    
    // Use only real expense data - no simulation
    const finalExpenseTotal = monthExpenseTotal
    
    // Use only real income data - no simulation
    let finalIncome = monthIncomeTotal
    
    if (finalIncome === 0 && monthlyIncome) {
      // Use profile monthly income if no detailed income for this month
      finalIncome = monthlyIncome
    }
    // Remove the fallback estimation - show only real data
    
    monthlyData.push({
      month: monthNames[month],
      monthNumber: month + 1,
      balance: finalIncome - finalExpenseTotal,
      income: finalIncome,
      expenses: finalExpenseTotal
    })
  }

  return monthlyData
}

/**
 * Calculate income from previous year for growth comparison
 */
async function calculatePreviousYearIncome(userId: string, year: number): Promise<number> {
  try {
    const startOfYear = `${year}-01-01`
    const endOfYear = `${year}-12-31`

    // Fetch previous year incomes
    const { data: incomes, error: incomesError } = await supabase
      .from('incomes')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', startOfYear)
      .lte('date', endOfYear)

    // Fetch previous year profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('monthly_income')
      .eq('id', userId)
      .single()

    // Calculate real income if available
    const detailedIncome = incomes?.reduce((sum, income) => sum + income.amount, 0) || 0
    const profileAnnualIncome = profile?.monthly_income ? profile.monthly_income * 12 : 0
    
    if (detailedIncome > 0 || profileAnnualIncome > 0) {
      return detailedIncome + profileAnnualIncome
    }

    // Fallback: estimate from expenses
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', startOfYear)
      .lte('date', endOfYear)

    if (error) {
      console.error('Error fetching previous year expenses:', error)
      return 0
    }

    // No fallback estimation - return 0 if no real income data
    return 0
  } catch (error) {
    console.error('Error calculating previous year income:', error)
    return 0
  }
}

/**
 * Generate insights based on the data
 */
function generateInsights(categoryData: CategoryData[], savingsRate: number, totalExpenses: number, totalIncome: number): Array<{ title: string; value: string; icon: string }> {
  const insights = []

  // Savings rate insight
  if (savingsRate > 20) {
    insights.push({
      title: 'Excellent savings rate!',
      value: `${savingsRate.toFixed(1)}%`,
      icon: '💰'
    })
  } else if (savingsRate > 10) {
    insights.push({
      title: 'Good savings rate',
      value: `${savingsRate.toFixed(1)}%`,
      icon: '📈'
    })
  }

  // Top category insight
  if (categoryData.length > 0) {
    const topCategory = categoryData[0]
    insights.push({
      title: `Most spent on ${topCategory.name}`,
      value: `€${topCategory.amount.toLocaleString()}`,
      icon: '🏆'
    })
  }

  // Expense reduction insight (simplified)
  if (totalExpenses > 0) {
    insights.push({
      title: 'Total expenses this year',
      value: `€${totalExpenses.toLocaleString()}`,
      icon: '💳'
    })
  }

  return insights.slice(0, 3) // Limit to 3 insights
}

/**
 * Default wrapped data when no real data is available
 */
function getDefaultWrappedData(): WrappedData {
  // Generate 12 months of empty data
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyBalances = monthNames.map((month, index) => ({
    month,
    monthNumber: index + 1,
    balance: 0,
    income: 0,
    expenses: 0
  }))

  return {
    totalExpenses: 0,
    totalIncome: 0,
    savings: 0,
    savingsRate: 0,
    incomeGrowth: 0,
    topCategory: 'No data',
    topCategoryAmount: 0,
    monthlyBalances,
    insights: [
      { title: 'Start tracking your expenses', value: 'to see insights', icon: '📊' }
    ],
    categoryData: [],
    categoryBreakdown: []
  }
}
