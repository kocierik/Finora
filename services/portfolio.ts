import { supabase } from '@/lib/supabase'
import { Investment } from '@/types'
import * as FileSystem from 'expo-file-system/legacy'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export async function parseInvestmentsFile(fileUri: string, userId: string): Promise<Investment[]> {
  if (fileUri.toLowerCase().includes('.csv')) {
    const raw = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' as any })
    const content = preprocessBrokerCsv(raw)
    const result = Papa.parse(content, { header: true, skipEmptyLines: true })
    return normalizeRows(result.data as any[], userId)
  }
  if (fileUri.toLowerCase().includes('.xlsx') || fileUri.toLowerCase().includes('.xls')) {
    const bin = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' as any })
    const wb = XLSX.read(bin, { type: 'base64' })
    const firstSheet = wb.SheetNames[0]
    const sheet = wb.Sheets[firstSheet]
    const rows = XLSX.utils.sheet_to_json(sheet)
    return normalizeRows(rows as any[], userId)
  }
  // fallback attempt: try CSV parse
  const content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' as any })
  const result = Papa.parse(preprocessBrokerCsv(content), { header: true, skipEmptyLines: true })
  return normalizeRows(result.data as any[], userId)
}

function normalizeRows(rows: any[], userId: string): Investment[] {
  const today = new Date().toISOString().slice(0, 10)
  const normalized = rows
    .filter((r) => hasAny(r, ['ticker', 'Ticker', 'Simbolo']) && hasAny(r, ['quantity', 'qty', 'Quantita', 'Quantità']) && hasAny(r, ['average_price', 'pu', 'Prezzo', 'P.zo medio di carico']))
    .map((r) => ({
      user_id: userId,
      ticker: String(r.ticker ?? r.Ticker ?? r.Simbolo).trim(),
      quantity: parseItNumber(r.quantity ?? r.qty ?? r.Quantita ?? r['Quantità']),
      average_price: parseItNumber(r.average_price ?? r.pu ?? r.Prezzo ?? r['P.zo medio di carico']),
      purchase_date: String(r.purchase_date ?? r.data ?? r['data acquisto'] ?? today),
      // Extended fields from CSV sample
      title: r.Titolo ?? r.title ?? undefined,
      isin: r.ISIN ?? r.isin ?? undefined,
      market: r.Mercato ?? r.market ?? undefined,
      instrument: r.Strumento ?? r.instrument ?? undefined,
      currency: r.Valuta ?? r.currency ?? undefined,
      fx_load: parseItNumber(r['Cambio di carico'] ?? r.fx_load),
      cost_value: parseItNumber(r['Valore di carico'] ?? r.cost_value),
      market_price: parseItNumber(r['P.zo di mercato'] ?? r.market_price),
      market_fx: parseItNumber(r['Cambio di mercato'] ?? r.market_fx),
      market_value_eur: parseItNumber(r['Valore di mercato €'] ?? r.market_value_eur),
      var_pct: parseItNumber(r['Var%'] ?? r.var_pct),
      var_eur: parseItNumber(r['Var €'] ?? r.var_eur),
      var_ccy: parseItNumber(r['Var in valuta'] ?? r.var_ccy),
      accrual_rateo: parseItNumber(r['Rateo'] ?? r.accrual_rateo),
    }))
  if (normalized.length === 0) {
    console.warn('Nessuna riga valida trovata. Verifica le intestazioni e i formati numerici del CSV/XLSX.')
  }
  return normalized
}

function hasAny(obj: any, keys: string[]) {
  return keys.some((k) => obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '')
}

// parse Italian numbers like "9,975.27" or "1.234,56"
function parseItNumber(value: any): number {
  if (typeof value === 'number') return value
  let s = String(value).trim()
  if (!s) return NaN
  // if there are both comma and dot, decide decimal by last separator
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    // comma decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // dot decimal, remove thousand commas
    s = s.replace(/,/g, '')
  } else {
    // only one kind or none
    s = s.replace(',', '.')
  }
  const n = Number(s)
  return isNaN(n) ? NaN : n
}

// Many brokers export CSVs with introductory rows and a trailing summary.
// This function keeps only the table from the header line containing
// recognizable columns (e.g. "Simbolo" or "Quantità") up to before a line starting with "Totale".
function preprocessBrokerCsv(content: string): string {
  const lines = content.split(/\r?\n/)
  let headerIdx = lines.findIndex((l) => /(^|,)\s*(Simbolo|Quantità|P\.zo medio di carico)\s*(,|$)/i.test(l))
  if (headerIdx === -1) return content
  let endIdx = lines.findIndex((l, i) => i > headerIdx && /^Totale(,|$)/i.test(l))
  const slice = lines.slice(headerIdx, endIdx === -1 ? undefined : endIdx)
  return slice.join('\n')
}

export async function upsertInvestments(items: Investment[]) {
  if (items.length === 0) return { error: null }
  const { error } = await supabase.from('investments').upsert(items, { onConflict: 'user_id,ticker,purchase_date' })
  return { error }
}

export async function fetchInvestments(userId: string) {
  const { data, error } = await supabase.from('investments').select('*').eq('user_id', userId).order('purchase_date', { ascending: true })
  return { data: (data as Investment[]) ?? [], error }
}

export async function deleteAllInvestmentsForUser(userId: string) {
  const { error } = await supabase.from('investments').delete().eq('user_id', userId)
  return { error }
}


