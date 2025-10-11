import { Dimensions, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

type Pt = { x: string | number; y: number }

export function PortfolioLine({ points }: { points: Pt[] }) {
  if (!points || points.length === 0) return <View />
  const labels = points.map((p) => String(p.x))
  const data = points.map((p) => p.y)
  const width = Dimensions.get('window').width - 48
  const height = 220
  return (
    <LineChart
      data={{ labels, datasets: [{ data, color: () => '#4e8ef7' }] }}
      width={width}
      height={height}
      withOuterLines={false}
      withInnerLines={false}
      chartConfig={{
        backgroundGradientFrom: 'transparent',
        backgroundGradientTo: 'transparent',
        decimalPlaces: 2,
        color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
        labelColor: (opacity = 0.7) => `rgba(255,255,255,${opacity})`,
        propsForDots: { r: '3', strokeWidth: '0', fill: '#4e8ef7' },
      }}
      bezier
      style={{ paddingRight: 0, marginLeft: -12 }}
    />
  )
}


