export type Investment = {
  id?: string
  user_id: string
  ticker: string
  quantity: number
  average_price: number
  purchase_date: string
  created_at?: string
  // Extended (CSV) fields
  title?: string
  isin?: string
  market?: string
  instrument?: string
  currency?: string
  fx_load?: number // Cambio di carico
  cost_value?: number // Valore di carico
  market_price?: number // P.zo di mercato
  market_fx?: number // Cambio di mercato
  market_value_eur?: number // Valore di mercato €
  var_pct?: number // Var%
  var_eur?: number // Var €
  var_ccy?: number // Var in valuta
  accrual_rateo?: number // Rateo
}

export type Expense = {
  id?: string
  user_id: string
  amount: number
  merchant: string
  category?: string // Legacy field, will be deprecated
  category_id?: string
  categories?: {
    id: string
    name: string
    icon: string
    color: string
  }
  currency?: string
  date: string
  raw_notification?: string
  created_at?: string
  // Recurring transaction support
  is_recurring?: boolean
  recurring_group_id?: string
  recurring_frequency?: string
  recurring_total_occurrences?: number
  recurring_index?: number
  recurring_infinite?: boolean
  recurring_stopped?: boolean
}

export type WalletNotification = {
  title: string
  text: string
  packageName: string
  postedAt: number
}

export type PortfolioStats = {
  totalValue: number
  totalCost: number
  pnl: number
  pnlPct: number
}


