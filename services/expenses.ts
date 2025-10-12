import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'

/**
 * Parser per notifiche Google Wallet
 * Formati supportati:
 * 1. "7,00 € con Mastercard **2995" (solo importo)
 * 2. "Pagamento di €12,34 presso COFFEE BAR il 10/09/2025" (completo)
 * 
 * Il merchant viene preso dal title della notifica
 */
const AMOUNT_REGEX = /([\d.,]+)\s*([€$£])/i
const DATE_REGEX = /(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/

export function parseWalletNotification(
  title: string,
  text: string
): Partial<Expense> & { merchant?: string } {
  // Estrai l'importo dal testo
  const amountMatch = text.match(AMOUNT_REGEX)
  let amount = undefined
  let currency = '€'
  
  if (amountMatch) {
    // Normalizza: "7,00" -> 7.00
    const normalized = amountMatch[1].replace(',', '.')
    amount = parseFloat(normalized)
    currency = amountMatch[2]
  }
  
  // Estrai il merchant dal title (prima parte prima di eventuali ": ")
  let merchant = title
  if (title.includes(':')) {
    merchant = title.split(':')[0].trim()
  }
  
  // Estrai la data se presente nel testo
  const dateMatch = text.match(DATE_REGEX)
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0]
  
  return { amount, currency, merchant, date }
}

export async function saveExpense(expense: Expense) {
  const { error } = await supabase.from('expenses').insert(expense)
  return { error }
}

export async function upsertExpenses(expenses: Expense[]) {
  if (expenses.length === 0) return { error: null }
  const { error } = await supabase.from('expenses').upsert(expenses)
  return { error }
}

export async function fetchExpenses(userId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  return { data: (data as Expense[]) ?? [], error }
}

export async function deleteExpense(expenseId: string) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
  return { error }
}


