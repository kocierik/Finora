import { ExpensesPie } from '@/components/charts/ExpensesPie'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Card } from '@/components/ui/Card'
import { ListItemCard } from '@/components/ui/ListItemCard'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'

export default function ExpensesScreen() {
  const { user } = useAuth()
  const [items, setItems] = useState<Expense[]>([])

  const fetchExpenses = async () => {
    if (!user) return
    const { data } = await supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setItems((data as Expense[]) ?? [])
  }

  useEffect(() => {
    fetchExpenses()
  }, [user?.id])

  // KPIs
  const now = new Date()
  const curMonth = now.getMonth()
  const curYear = now.getFullYear()
  const prevMonthDate = new Date(curYear, curMonth - 1, 1)
  const prevMonth = prevMonthDate.getMonth()
  const prevYear = prevMonthDate.getFullYear()
  const monthTotal = items.filter((e) => sameMonth(e.date, curYear, curMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const prevTotal = items.filter((e) => sameMonth(e.date, prevYear, prevMonth)).reduce((s, e) => s + (e.amount || 0), 0)
  const delta = monthTotal - prevTotal
  const deltaPct = prevTotal > 0 ? (delta / prevTotal) * 100 : 0

  const monthName = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <FlatList
      data={items}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <ThemedView style={styles.headerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>Spese</ThemedText>
            <ThemedText style={styles.subtitle}>{monthName}</ThemedText>
          </View>

          {/* Main KPI Card */}
          <Card style={styles.mainKpiCard} glow="rgba(239, 68, 68, 0.15)">
            <View style={styles.mainKpiHeader}>
              <View style={styles.mainKpiIconContainer}>
                <View style={styles.mainKpiIcon}>
                  <ThemedText style={styles.mainKpiIconText}>💳</ThemedText>
                </View>
                <View style={styles.neonLine} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.mainKpiLabel}>Totale questo mese</ThemedText>
                <ThemedText type="title" style={styles.mainKpiValue}>
                  € {monthTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </ThemedText>
              </View>
            </View>
            
            {/* Comparison with previous month */}
            <View style={styles.comparisonRow}>
              <View style={[styles.comparisonBadge, { 
                backgroundColor: delta >= 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                borderColor: delta >= 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
              }]}>
                <ThemedText style={[styles.comparisonText, { color: delta >= 0 ? '#ef4444' : '#10b981' }]}>
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </ThemedText>
              </View>
              <ThemedText style={styles.comparisonLabel}>
                vs mese precedente (€ {prevTotal.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </ThemedText>
            </View>
          </Card>

          {/* Secondary KPIs */}
          <View style={styles.secondaryKpis}>
            <Card style={styles.secondaryKpiCard} glow={deltaPct >= 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)"}>
              <View style={styles.secondaryIconCircle}>
                <ThemedText style={styles.secondaryIcon}>{deltaPct >= 0 ? '📈' : '📉'}</ThemedText>
              </View>
              <ThemedText style={styles.secondaryKpiLabel}>Variazione</ThemedText>
              <ThemedText type="title" style={[styles.secondaryKpiValue, { color: deltaPct >= 0 ? '#ef4444' : '#10b981' }]}>
                {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%
              </ThemedText>
            </Card>
            <Card style={styles.secondaryKpiCard} glow="rgba(99, 102, 241, 0.1)">
              <View style={[styles.secondaryIconCircle, styles.secondaryIconCircleBlue]}>
                <ThemedText style={styles.secondaryIcon}>🧾</ThemedText>
              </View>
              <ThemedText style={styles.secondaryKpiLabel}>Transazioni</ThemedText>
              <ThemedText type="title" style={styles.secondaryKpiValue}>
                {items.filter((e) => sameMonth(e.date, curYear, curMonth)).length}
              </ThemedText>
            </Card>
          </View>

          {/* Chart */}
          <Card style={styles.chartCard} glow="rgba(139, 92, 246, 0.1)">
            <View style={styles.chartHeader}>
              <View style={styles.chartIconCircle}>
                <ThemedText style={styles.chartIcon}>📊</ThemedText>
              </View>
              <ThemedText type="defaultSemiBold" style={styles.chartTitle}>Distribuzione per categoria</ThemedText>
            </View>
            <View style={styles.chartContainer}>
              <ExpensesPie items={items} />
            </View>
          </Card>

          {/* Transactions Header */}
          <View style={styles.transactionsHeader}>
            <ThemedText type="defaultSemiBold" style={styles.transactionsTitle}>Transazioni recenti</ThemedText>
            <ThemedText style={styles.transactionsCount}>{items.length}</ThemedText>
          </View>
        </ThemedView>
      }
      keyExtractor={(it, idx) => it.id ?? String(idx)}
      renderItem={({ item }) => (
        <ListItemCard
          title={item.merchant ?? '—'}
          subtitle={formatDate(item.date)}
          right={
            <ThemedText style={styles.amountText}>
              € {item.amount?.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </ThemedText>
          }
        />
      )}
      ListEmptyComponent={
        <Card style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>Nessuna spesa registrata</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Le spese da Google Wallet verranno aggiunte automaticamente
          </ThemedText>
        </Card>
      }
    />
  )
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  try {
    const parts = dateStr.includes('/') ? dateStr.split('/') : []
    let d: Date
    if (parts.length >= 3) {
      const dd = parseInt(parts[0], 10)
      const mm = parseInt(parts[1], 10) - 1
      const yy = parseInt(parts[2], 10)
      d = new Date(yy, mm, dd)
    } else {
      d = new Date(dateStr)
    }
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const styles = StyleSheet.create({
  container: { 
    padding: 20, 
    paddingBottom: 40,
  },
  headerContainer: {
    gap: 16,
    marginBottom: 24,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    textTransform: 'capitalize',
  },
  mainKpiCard: {
    padding: 24,
  },
  mainKpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  mainKpiIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  mainKpiIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neonLine: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  mainKpiIconText: {
    fontSize: 32,
  },
  mainKpiLabel: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainKpiValue: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#ef4444',
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  comparisonBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  comparisonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  comparisonLabel: {
    fontSize: 12,
    opacity: 0.6,
    flex: 1,
  },
  secondaryKpis: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryKpiCard: {
    flex: 1,
    padding: 20,
  },
  secondaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryIconCircleBlue: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  secondaryIcon: {
    fontSize: 20,
  },
  secondaryKpiLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryKpiValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  chartCard: {
    padding: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  chartIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartIcon: {
    fontSize: 24,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  chartContainer: {
    height: 220,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionsTitle: {
    fontSize: 17,
  },
  transactionsCount: {
    fontSize: 14,
    opacity: 0.5,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    opacity: 0.5,
    textAlign: 'center',
  },
})

function sameMonth(dateStr: string, year: number, monthIndex: number) {
  // Accept formats like DD/MM/YYYY or ISO
  if (!dateStr) return false
  const parts = dateStr.includes('/') ? dateStr.split('/') : []
  let d: Date
  if (parts.length >= 3) {
    const dd = parseInt(parts[0], 10)
    const mm = parseInt(parts[1], 10) - 1
    const yy = parseInt(parts[2], 10)
    d = new Date(yy, mm, dd)
  } else {
    d = new Date(dateStr)
  }
  return d.getFullYear() === year && d.getMonth() === monthIndex
}


