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
  category_id?: string
  timestamp: number
  synced: boolean
}

// Flag per prevenire sincronizzazioni multiple simultanee
let isSyncing = false

/**
 * Esegue la pulizia automatica dei duplicati (non blocca se fallisce)
 */
export async function autoCleanupDuplicates(userId: string): Promise<void> {
  try {
    console.log('[ExpenseSync] 🧹 Auto-cleaning duplicates...')
    const cleanupResult = await cleanAllDuplicates(userId)
    if (cleanupResult.removed > 0) {
      console.log(`[ExpenseSync] ✅ Auto-cleaned ${cleanupResult.removed} duplicates`)
    }
  } catch (cleanupError) {
    console.log('[ExpenseSync] ⚠️  Auto-cleanup failed:', cleanupError)
    // Non bloccare l'operazione principale se la pulizia fallisce
  }
}

/**
 * Sincronizza le spese pendenti dalla cache al database Supabase
 */
export async function syncPendingExpenses(userId: string): Promise<{ synced: number; errors: number }> {
  // Prevenire sincronizzazioni multiple simultanee
  if (isSyncing) {
    console.log('[ExpenseSync] ⚠️  Sync already in progress, skipping...')
    return { synced: 0, errors: 0 }
  }
  
  isSyncing = true
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
        // Se abbiamo un category_id, usalo; altrimenti cerca la categoria "Other" per l'utente
        let categoryId = expense.category_id
        
        if (!categoryId) {
          // Cerca la categoria "Other" per l'utente
          const { data: otherCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', userId)
            .eq('name', 'Other')
            .single()
          
          if (otherCategory) {
            categoryId = otherCategory.id
          } else {
            console.log('[ExpenseSync] ⚠️  No "Other" category found for user, skipping expense')
            errorCount++
            continue
          }
        }
        
        const expenseData: Omit<Expense, 'id' | 'created_at'> = {
          user_id: userId,
          amount: expense.amount,
          currency: expense.currency,
          merchant: expense.merchant,
          date: expense.date,
          raw_notification: expense.description || '',
          category_id: categoryId,
        }
        
        // Controlla se esiste già una spesa identica (stesso amount, merchant, date)
        const { data: existingExpenses } = await supabase
          .from('expenses')
          .select('id, created_at')
          .eq('user_id', userId)
          .eq('amount', expense.amount)
          .eq('merchant', expense.merchant)
          .eq('date', expense.date)
          .order('created_at', { ascending: false })
        
        if (existingExpenses && existingExpenses.length > 0) {
          // Controlla se c'è una spesa con differenza temporale di 2 secondi o meno
          const now = new Date()
          const isDuplicate = existingExpenses.some(existing => {
            const existingTime = new Date(existing.created_at)
            const timeDiff = Math.abs(now.getTime() - existingTime.getTime())
            return timeDiff <= 2000 // 2 secondi in millisecondi
          })
          
          if (isDuplicate) {
            console.log(`[ExpenseSync] ⚠️  Duplicate expense found (within 2 seconds), skipping: ${expense.merchant} - ${expense.amount}${expense.currency}`)
            // Marca come sincronizzata anche se è un duplicato
            expense.synced = true
            continue
          }
          
          // Se non è un duplicato temporale ma è identico, controlla se è troppo recente (es. ultimi 5 minuti)
          const mostRecent = existingExpenses[0]
          const timeDiff = Math.abs(now.getTime() - new Date(mostRecent.created_at).getTime())
          if (timeDiff <= 300000) { // 5 minuti in millisecondi
            console.log(`[ExpenseSync] ⚠️  Identical expense found (within 5 minutes), skipping: ${expense.merchant} - ${expense.amount}${expense.currency}`)
            // Marca come sincronizzata anche se è un duplicato
            expense.synced = true
            continue
          }
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
    
    // Pulizia automatica dei duplicati dopo la sincronizzazione
    if (syncedCount > 0) {
      await autoCleanupDuplicates(userId)
    }
    
    console.log(`[ExpenseSync] 🎉 Sync completed: ${syncedCount} synced, ${errorCount} errors`)
    
    return { synced: syncedCount, errors: errorCount }
  } catch (error) {
    console.log('[ExpenseSync] ❌ Sync failed:', error)
    return { synced: 0, errors: 1 }
  } finally {
    isSyncing = false
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

/**
 * Rimuove i duplicati temporali esistenti dal database (differenza di 2 secondi)
 */
export async function removeTemporalDuplicates(userId: string): Promise<{ removed: number }> {
  try {
    console.log('[ExpenseSync] 🔍 Looking for temporal duplicate expenses (2 seconds)...')
    
    // Trova tutte le spese dell'utente ordinate per created_at
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('id, amount, merchant, date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.log('[ExpenseSync] ❌ Error finding expenses:', error.message)
      return { removed: 0 }
    }
    
    if (!expenses || expenses.length === 0) {
      console.log('[ExpenseSync] ✅ No expenses found')
      return { removed: 0 }
    }
    
    let removedCount = 0
    const processedIds = new Set<string>()
    
    // Controlla ogni spesa con le successive per trovare duplicati temporali
    for (let i = 0; i < expenses.length - 1; i++) {
      if (processedIds.has(expenses[i].id)) continue
      
      const current = expenses[i]
      const duplicates = [current]
      
      // Cerca duplicati temporali nelle spese successive
      for (let j = i + 1; j < expenses.length; j++) {
        if (processedIds.has(expenses[j].id)) continue
        
        const next = expenses[j]
        
        // Controlla se sono la stessa spesa (amount, merchant, date)
        if (current.amount === next.amount && 
            current.merchant === next.merchant && 
            current.date === next.date) {
          
          const timeDiff = Math.abs(
            new Date(next.created_at).getTime() - new Date(current.created_at).getTime()
          )
          
          // Se la differenza è di 2 secondi o meno, è un duplicato temporale
          if (timeDiff <= 2000) {
            duplicates.push(next)
            processedIds.add(next.id)
            console.log(`[ExpenseSync] 🔍 Found temporal duplicate: ${next.merchant} - ${next.amount}€ (${timeDiff}ms difference)`)
          }
        }
      }
      
      // Se ci sono duplicati, mantieni solo il più recente
      if (duplicates.length > 1) {
        // Ordina per created_at (il più recente per ultimo)
        duplicates.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        
        // Rimuovi tutti tranne l'ultimo (più recente)
        const toRemove = duplicates.slice(0, -1)
        
        for (const expense of toRemove) {
          const { error: deleteError } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expense.id)
          
          if (!deleteError) {
            removedCount++
            processedIds.add(expense.id)
            console.log(`[ExpenseSync] 🗑️  Removed temporal duplicate: ${expense.merchant} - ${expense.amount}€`)
          }
        }
      }
    }
    
    console.log(`[ExpenseSync] ✅ Removed ${removedCount} temporal duplicate expenses`)
    return { removed: removedCount }
  } catch (error) {
    console.log('[ExpenseSync] ❌ Error removing temporal duplicates:', error)
    return { removed: 0 }
  }
}

/**
 * Pulisce tutti i duplicati esistenti nel database (temporali + identici)
 */
export async function cleanAllDuplicates(userId: string): Promise<{ removed: number }> {
  try {
    console.log('[ExpenseSync] 🧹 Cleaning all duplicates from database...')
    
    // Prima rimuovi i duplicati temporali
    const temporalResult = await removeTemporalDuplicates(userId)
    console.log(`[ExpenseSync] ✅ Temporal duplicates removed: ${temporalResult.removed}`)
    
    // Poi rimuovi i duplicati identici
    const regularResult = await removeDuplicateExpenses(userId)
    console.log(`[ExpenseSync] ✅ Regular duplicates removed: ${regularResult.removed}`)
    
    const totalRemoved = temporalResult.removed + regularResult.removed
    console.log(`[ExpenseSync] 🎉 Total duplicates cleaned: ${totalRemoved}`)
    
    return { removed: totalRemoved }
  } catch (error) {
    console.log('[ExpenseSync] ❌ Error cleaning all duplicates:', error)
    return { removed: 0 }
  }
}

/**
 * Rimuove i duplicati esistenti dal database (inclusi quelli temporali)
 */
export async function removeDuplicateExpenses(userId: string): Promise<{ removed: number }> {
  try {
    console.log('[ExpenseSync] 🔍 Looking for duplicate expenses (including temporal)...')
    
    // Prima rimuovi i duplicati temporali
    const temporalResult = await removeTemporalDuplicates(userId)
    console.log(`[ExpenseSync] ✅ Temporal duplicates removed: ${temporalResult.removed}`)
    
    // Poi rimuovi i duplicati normali
    console.log('[ExpenseSync] 🔍 Looking for regular duplicate expenses...')
    
    // Trova duplicati basati su user_id, amount, merchant, date
    const { data: duplicates, error } = await supabase
      .from('expenses')
      .select('id, amount, merchant, date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.log('[ExpenseSync] ❌ Error finding duplicates:', error.message)
      return { removed: 0 }
    }
    
    if (!duplicates || duplicates.length === 0) {
      console.log('[ExpenseSync] ✅ No duplicates found')
      return { removed: 0 }
    }
    
    // Raggruppa per chiave unica (amount, merchant, date)
    const grouped = duplicates.reduce((acc, expense) => {
      const key = `${expense.amount}-${expense.merchant}-${expense.date}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(expense)
      return acc
    }, {} as Record<string, any[]>)
    
    let removedCount = 0
    
    // Per ogni gruppo con più di un elemento, controlla le differenze temporali
    for (const group of Object.values(grouped)) {
      if (group.length > 1) {
        // Ordina per created_at (il più recente per ultimo)
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        
        // Trova duplicati basati su differenza temporale di 2 secondi
        const toRemove: any[] = []
        
        for (let i = 0; i < group.length - 1; i++) {
          const current = group[i]
          const next = group[i + 1]
          
          const timeDiff = Math.abs(
            new Date(next.created_at).getTime() - new Date(current.created_at).getTime()
          )
          
          // Se la differenza è di 2 secondi o meno, considera il primo come duplicato
          if (timeDiff <= 2000) {
            toRemove.push(current)
            console.log(`[ExpenseSync] 🔍 Found temporal duplicate: ${current.merchant} - ${current.amount}€ (${timeDiff}ms difference)`)
          }
        }
        
        // Rimuovi i duplicati identificati
        for (const expense of toRemove) {
          const { error: deleteError } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expense.id)
          
          if (!deleteError) {
            removedCount++
            console.log(`[ExpenseSync] 🗑️  Removed temporal duplicate: ${expense.merchant} - ${expense.amount}€`)
          }
        }
      }
    }
    
    const totalRemoved = temporalResult.removed + removedCount
    console.log(`[ExpenseSync] ✅ Removed ${totalRemoved} total duplicate expenses (${temporalResult.removed} temporal + ${removedCount} regular)`)
    return { removed: totalRemoved }
  } catch (error) {
    console.log('[ExpenseSync] ❌ Error removing duplicates:', error)
    return { removed: 0 }
  }
}

