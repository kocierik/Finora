import { Expense } from '@/types';
import { Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

type Slice = { label: string; value: number; color: string }

export function ExpensesPie({ items }: { items: Expense[] }) {
  // Filter for current month only
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()
  
  const sameMonth = (dateStr: string, year: number, monthIndex: number) => {
    if (!dateStr) return false
    const parts = dateStr.includes('/') ? dateStr.split('/') : []
    let d: Date
    if (parts.length >= 3) {
      const dd = parseInt(parts[0], 10)
      const mm = parseInt(parts[1], 10) - 1
      const yyyy = parseInt(parts[2], 10)
      d = new Date(yyyy, mm, dd)
    } else {
      d = new Date(dateStr)
    }
    return d.getFullYear() === year && d.getMonth() === monthIndex
  }
  
  const currentMonthItems = items.filter(e => sameMonth(e.date, curYear, curMonth))
  
  const byCat = currentMonthItems.reduce<Record<string, number>>((acc, e) => {
    const key = e.category ?? 'Other'
    acc[key] = (acc[key] ?? 0) + e.amount
    return acc
  }, {})
  
  // Debug log
  console.log('ExpensesPie debug:', {
    totalItems: items.length,
    currentMonthItems: currentMonthItems.length,
    byCat,
    sampleItems: currentMonthItems.slice(0, 3).map(e => ({ merchant: e.merchant, category: e.category, amount: e.amount, date: e.date }))
  })

  const palette = ['#4e8ef7', '#f77f00', '#2a9d8f', '#e76f51', '#6a4c93', '#00b4d8', '#f94144']
  const slices: Slice[] = Object.entries(byCat).map(([label, value], i) => ({
    label,
    value,
    color: palette[i % palette.length],
  }))
  const width = Dimensions.get('window').width - 48
  const height = 220
  const data = slices.map((s) => ({ name: s.label, population: s.value, color: s.color, legendFontColor: '#bbb', legendFontSize: 12 }))
  return (
    <PieChart
      data={data}
      width={width}
      height={height}
      chartConfig={{
        backgroundGradientFrom: 'transparent',
        backgroundGradientTo: 'transparent',
        color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
        labelColor: (opacity = 0.7) => `rgba(255,255,255,${opacity})`,
      }}
      accessor="population"
      backgroundColor="transparent"
      paddingLeft="16"
      absolute
      hasLegend
      center={[0, 0]}
    />
  )
}



