import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'

type PendingExpense = {
  amount: number
  currency: string
  merchant: string
  date: string
  description: string
  category: string
  timestamp: number
  synced: boolean
}

/**
 * Sincronizza le spese pendenti dalla cache al database Supabase
 */
export async function syncPendingExpenses(userId: string): Promise<{ synced: number; errors: number }> {
  console.log('[ExpenseSync] 🔄 Starting sync...')
  
  try {
    const expensesFile = `${cacheDirectory}pending_expenses.json`
    
    // Leggi le spese pendenti
    let pendingExpenses: PendingExpense[] = []
    try {
      const data = await readAsStringAsync(expensesFile)
      pendingExpenses = JSON.parse(data)
    } catch (error) {
      console.log('[ExpenseSync] ℹ️  No pending expenses found')
      return { synced: 0, errors: 0 }
    }
    
    // Filtra solo le spese non sincronizzate
    const unsyncedExpenses = pendingExpenses.filter(e => !e.synced)
    
    if (unsyncedExpenses.length === 0) {
      console.log('[ExpenseSync] ✅ All expenses already synced')
      return { synced: 0, errors: 0 }
    }
    
    console.log(`[ExpenseSync] 📤 Syncing ${unsyncedExpenses.length} expenses...`)
    
    let syncedCount = 0
    let errorCount = 0
    
    // Sincronizza ogni spesa
    for (const expense of unsyncedExpenses) {
      try {
        const expenseData: Omit<Expense, 'id' | 'created_at'> = {
          user_id: userId,
          amount: expense.amount,
          currency: expense.currency,
          merchant: expense.merchant,
          date: expense.date,
          description: expense.description,
          category: expense.category,
        }
        
        const { error } = await supabase
          .from('expenses')
          .insert(expenseData)
        
        if (error) {
          console.log('[ExpenseSync] ❌ Error syncing expense:', error.message)
          errorCount++
        } else {
          console.log(`[ExpenseSync] ✅ Synced expense: ${expense.merchant} - ${expense.amount}${expense.currency}`)
          // Marca come sincronizzata
          expense.synced = true
          syncedCount++
        }
      } catch (error) {
        console.log('[ExpenseSync] ❌ Exception syncing expense:', error)
        errorCount++
      }
    }
    
    // Salva le spese aggiornate (con flag synced=true)
    await writeAsStringAsync(expensesFile, JSON.stringify(pendingExpenses))
    
    console.log(`[ExpenseSync] 🎉 Sync completed: ${syncedCount} synced, ${errorCount} errors`)
    
    return { synced: syncedCount, errors: errorCount }
  } catch (error) {
    console.log('[ExpenseSync] ❌ Sync failed:', error)
    return { synced: 0, errors: 1 }
  }
}

/**
 * Pulisce le spese sincronizzate dalla cache
 */
export async function cleanSyncedExpenses(): Promise<void> {
  try {
    const expensesFile = `${cacheDirectory}pending_expenses.json`
    
    const data = await readAsStringAsync(expensesFile)
    const pendingExpenses: PendingExpense[] = JSON.parse(data)
    
    // Mantieni solo le spese non sincronizzate
    const unsyncedExpenses = pendingExpenses.filter(e => !e.synced)
    
    await writeAsStringAsync(expensesFile, JSON.stringify(unsyncedExpenses))
    
    console.log(`[ExpenseSync] 🗑️  Cleaned ${pendingExpenses.length - unsyncedExpenses.length} synced expenses`)
  } catch (error) {
    console.log('[ExpenseSync] ⚠️  Could not clean synced expenses:', error)
  }
}

