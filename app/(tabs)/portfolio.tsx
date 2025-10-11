import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Badge } from '@/components/ui/Badge'
import { Card, KPI } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { deleteAllInvestmentsForUser, fetchInvestments, parseInvestmentsFile, upsertInvestments } from '@/services/portfolio'
import { Investment } from '@/types'
import * as DocumentPicker from 'expo-document-picker'
import { useEffect, useState } from 'react'
import { Button, Dimensions, FlatList, StyleSheet, View } from 'react-native'
import { PieChart } from 'react-native-chart-kit'

export default function PortfolioScreen() {
  const { user, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [lastCount, setLastCount] = useState<number | null>(null)
  const [stats, setStats] = useState<{ totalCost: number; totalMarket?: number; pnl?: number; pnlPct?: number } | null>(null)
  const [allocation, setAllocation] = useState<{ name: string; value: number }[]>([])
  const [holdings, setHoldings] = useState<Investment[]>([])
  const [totals, setTotals] = useState<{ invested: number; market: number; pnl: number; pnlPct: number } | null>(null)

  // Auth guard - redirect if not logged in
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Caricamento...</ThemedText>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>Accesso non autorizzato</ThemedText>
        <ThemedText style={styles.errorSubtext}>Effettua il login per continuare</ThemedText>
      </View>
    )
  }

  async function computeTotals(inv: Investment[]) {
    if (!inv || inv.length === 0) {
      setTotals(null)
      return
    }
    let invested = 0
    let market = 0
    for (const i of inv) {
      const cost = i.cost_value != null ? Number(i.cost_value) : (i.quantity || 0) * (i.average_price || 0)
      const mkt = i.market_value_eur != null ? Number(i.market_value_eur) : (i.quantity || 0) * (i.average_price || 0)
      invested += cost
      market += mkt
    }
    const pnl = market - invested
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
    setTotals({ invested, market, pnl, pnlPct })
  }

  const onImport = async () => {
    if (!user) return
    setBusy(true)
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
      if (res.canceled || !res.assets?.[0]?.uri) return
      const uri = res.assets[0].uri
      const items = await parseInvestmentsFile(uri, user.id)
      if (!items || items.length === 0) {
        alert('Nessuna riga importata. Controlla che il file abbia intestazioni compatibili e numeri nel formato corretto.')
      }
      const { error } = await upsertInvestments(items)
      if (error) throw error
      setLastCount(items.length)
      // refresh from DB after import
      const { data } = await fetchInvestments(user.id)
      setHoldings(data)
      // derive quick stats if CSV contains columns Valore di carico / Valore di mercato
      const totalCost = sumNumbers(items as any, ['Valore di carico'])
      const totalMkt = sumNumbers(items as any, ['Valore di mercato', 'Valore di mercato €'])
      if (totalCost && totalMkt) {
        const pnl = totalMkt - totalCost
        const pnlPct = (pnl / totalCost) * 100
        setStats({ totalCost, totalMarket: totalMkt, pnl, pnlPct })
      }
      // build allocation by ticker based on quantity * average_price when totals are missing
      const byTicker: Record<string, number> = {}
      for (const it of items) {
        const val = (it.quantity || 0) * (it.average_price || 0)
        byTicker[it.ticker] = (byTicker[it.ticker] ?? 0) + val
      }
      const alloc = Object.entries(byTicker).map(([name, value]) => ({ name, value }))
      setAllocation(alloc)
      await computeTotals(items)
    } catch (e: any) {
      alert(`Errore import: ${e?.message ?? 'sconosciuto'}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    (async () => {
      if (!user) return
      const { data } = await fetchInvestments(user.id)
      setHoldings(data)
      await computeTotals(data)
    })()
  }, [user?.id])

  return (
    <FlatList
      data={[]}
      ListHeaderComponent={
        <ThemedView style={[styles.container, { paddingTop: 48 }]}> 
          <ThemedText type="title">Portafoglio</ThemedText>
          <ThemedText>Importa CSV/XLSX (ticker, quantity, average_price, purchase_date)</ThemedText>
          {totals && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card style={{ flex: 1 }}>
                <KPI label="Totale investito" value={`€ ${totals.invested.toFixed(2)}`} />
              </Card>
              <Card style={{ flex: 1 }}>
                <KPI label="Valore attuale" value={`€ ${totals.market.toFixed(2)}`} />
              </Card>
            </View>
          )}
          {totals && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card style={{ flex: 1 }}>
                <KPI label="Varianza" value={`€ ${totals.pnl.toFixed(2)}`} accent={totals.pnl >= 0 ? '#2a9d8f' : '#e76f51'} />
              </Card>
              <Card style={{ flex: 1 }}>
                <KPI label="Varianza %" value={`${totals.pnlPct.toFixed(2)}%`} accent={totals.pnl >= 0 ? '#2a9d8f' : '#e76f51'} />
              </Card>
            </View>
          )}
          {stats && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Card style={{ flex: 1 }}>
                <KPI label="PnL" value={`€ ${(stats.pnl ?? 0).toFixed(2)}`} accent={(stats.pnl ?? 0) >= 0 ? '#2a9d8f' : '#e76f51'} />
              </Card>
              <Card style={{ flex: 1 }}>
                <KPI label="PnL %" value={`${(stats.pnlPct ?? 0).toFixed(2)}%`} accent={(stats.pnl ?? 0) >= 0 ? '#2a9d8f' : '#e76f51'} />
              </Card>
            </View>
          )}
          {holdings.length === 0 && (
            <Button title={busy ? 'Import...' : 'Import CSV/XLSX'} onPress={onImport} disabled={busy} />
          )}
          {lastCount != null && <ThemedText>Importati: {lastCount}</ThemedText>}
          {holdings.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title="Sostituisci portafoglio" onPress={async () => {
                if (!user) return
                setBusy(true)
                try {
                  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
                  if (res.canceled || !res.assets?.[0]?.uri) return
                  const uri = res.assets[0].uri
                  const items = await parseInvestmentsFile(uri, user.id)
                  await deleteAllInvestmentsForUser(user.id)
                  const { error } = await upsertInvestments(items)
                  if (error) throw error
                  const { data } = await fetchInvestments(user.id)
                  setHoldings(data)
                  setLastCount(items.length)
                } catch (e: any) {
                  alert(`Errore sostituzione: ${e?.message ?? 'sconosciuto'}`)
                } finally {
                  setBusy(false)
                }
              }} />
              <Button title="Elimina tutto" onPress={async () => {
                if (!user) return
                setBusy(true)
                try {
                  const { error } = await deleteAllInvestmentsForUser(user.id)
                  if (error) throw error
                  setHoldings([])
                  setStats(null)
                  setAllocation([])
                } catch (e: any) {
                  alert(`Errore eliminazione: ${e?.message ?? 'sconosciuto'}`)
                } finally {
                  setBusy(false)
                }
              }} />
            </View>
          )}
          {allocation.length > 0 && (
            <Card style={{ marginTop: 12 }}>
              <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Allocazione per ticker</ThemedText>
              <View style={{ height: 240 }}>
                <PieChart
                  data={allocation.map((a, i) => ({
                    name: a.name,
                    population: a.value,
                    color: palette[i % palette.length],
                    legendFontColor: '#bbb',
                    legendFontSize: 12,
                  }))}
                  width={Dimensions.get('window').width - 48}
                  height={220}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="16"
                  absolute
                  chartConfig={{
                    backgroundGradientFrom: 'transparent',
                    backgroundGradientTo: 'transparent',
                    color: (o = 1) => `rgba(255,255,255,${o})`,
                    labelColor: (o = 0.7) => `rgba(255,255,255,${o})`,
                  }}
                />
              </View>
            </Card>
          )}
          
        </ThemedView>
      }
      renderItem={() => null}
      ListFooterComponent={
        holdings.length > 0 ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <ThemedText type="defaultSemiBold">Posizioni</ThemedText>
            {holdings.map((h, i) => {
              const invested = h.cost_value != null ? Number(h.cost_value) : (h.quantity || 0) * (h.average_price || 0)
              const value = h.market_value_eur != null ? Number(h.market_value_eur) : (h.quantity || 0) * (h.average_price || 0)
              const pnl = h.var_eur != null ? Number(h.var_eur) : (value - invested)
              const pnlPct = h.var_pct != null ? Number(h.var_pct) : (invested > 0 ? (pnl / invested) * 100 : 0)
              return (
                <Card key={i}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText type="defaultSemiBold">{h.ticker} {h.title ? `• ${h.title}` : ''}</ThemedText>
                    <ThemedText style={{ opacity: 0.8 }}>{new Date(h.purchase_date).toLocaleDateString()}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <Badge label={`Qty ${h.quantity}`} />
                    <Badge label={`PM € ${h.average_price}`} />
                    {h.isin && <Badge label={`ISIN ${h.isin}`} />}
                    {h.market && <Badge label={`Mercato ${h.market}`} />}
                    {h.instrument && <Badge label={`Strum. ${h.instrument}`} />}
                    {h.currency && <Badge label={`Valuta ${h.currency}`} />}
                    {h.fx_load != null && <Badge label={`Fx carico ${h.fx_load}`} />}
                    <Badge label={`Val € ${value.toFixed(2)}`} />
                    {h.market_price != null && <Badge label={`P. mercato € ${h.market_price}`} />}
                    {h.market_fx != null && <Badge label={`Fx mercato ${h.market_fx}`} />}
                    <Badge label={`Var € ${pnl.toFixed(2)}`} accent={pnl >= 0 ? '#2a9d8f' : '#e76f51'} />
                    <Badge label={`Var % ${pnlPct.toFixed(2)}%`} accent={pnl >= 0 ? '#2a9d8f' : '#e76f51'} />
                    {h.var_ccy != null && <Badge label={`Var in valuta ${h.var_ccy}`} />}
                    {h.accrual_rateo != null && <Badge label={`Rateo ${h.accrual_rateo}`} />}
                  </View>
                </Card>
              )
            })}
          </View>
        ) : null
      }
    />
  )
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8EEF8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 16,
    fontWeight: '400',
    color: '#9ca3af',
    textAlign: 'center',
  },
})

function sumNumbers(items: any[], keys: string[]) {
  const vals = items
    .map((r) => {
      for (const k of keys) {
        if (r[k] != null && String(r[k]).trim() !== '') return parseItNumber(r[k])
      }
      return 0
    })
  return vals.reduce((s, n) => s + (isNaN(n) ? 0 : n), 0)
}

function parseItNumber(value: any): number {
  if (typeof value === 'number') return value
  let s = String(value).trim()
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, '')
  } else {
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? NaN : n
}

const palette = ['#4e8ef7', '#2a9d8f', '#6a4c93', '#00b4d8', '#f77f00', '#e76f51', '#f94144']


