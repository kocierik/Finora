import { Expense } from '@/types';
import { Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

type Slice = { label: string; value: number; color: string }

export function ExpensesPie({ items }: { items: Expense[] }) {
  const byCat = items.reduce<Record<string, number>>((acc, e) => {
    const key = e.category ?? 'Altro'
    acc[key] = (acc[key] ?? 0) + e.amount
    return acc
  }, {})

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



