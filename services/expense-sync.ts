import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'
import { DeviceEventEmitter } from 'react-native'
import { sendWeeklyBulkCategoryReminder } from './category-reminder'

type PendingExpense = {
  amount: number
  currency: string
  merchant: string
  date: string
  description?: string // Legacy field
  raw_notification?: string // Actual field used by headless task
  category?: string // Optional, not always set by headless task
  category_id?: string
  timestamp: number
  synced: boolean
}

type PendingIncome = {
  amount: number
  currency: string
  source: string
  category: string
  date: string
  description?: string
  raw_notification?: string
  timestamp: number
  synced: boolean
}

// Flag per prevenire sincronizzazioni multiple simultanee
let isSyncing = false
let isSyncingIncomes = false

/**
 * Esegue la pulizia automatica dei duplicati (non blocca se fallisce)
 */
export async function autoCleanupDuplicates(userId: string): Promise<void> {
  try {
    const cleanupResult = await cleanAllDuplicates(userId)
    if (cleanupResult.removed > 0) {
      // Notifica l'UI che sono stati rimossi dei duplicati
      DeviceEventEmitter.emit('expenses:duplicatesRemoved', {
        removed: cleanupResult.removed,
        userId: userId
      })
    }
  } catch (cleanupError) {
    // Non bloccare l'operazione principale se la pulizia fallisce
  }
}

/**
 * Sincronizza le spese pendenti dalla cache al database Supabase
 */
export async function syncPendingExpenses(userId: string): Promise<{ synced: number; errors: number }> {
  // Prevenire sincronizzazioni multiple simultanee
  if (isSyncing) {
    return { synced: 0, errors: 0 }
  }
  
  isSyncing = true
  
  try {
    const expensesFile = `${cacheDirectory}pending_expenses.json`
    
    // Leggi le spese pendenti
    let pendingExpenses: PendingExpense[] = []
    try {
      const data = await readAsStringAsync(expensesFile)
      pendingExpenses = JSON.parse(data)
    } catch (error) {
      return { synced: 0, errors: 0 }
    }
    
    // Filtra solo le spese non sincronizzate
    const unsyncedExpenses = pendingExpenses.filter(e => !e.synced)
    
    if (unsyncedExpenses.length === 0) {
      return { synced: 0, errors: 0 }
    }
    
    // Invia notifica di promemoria settimanale se ci sono spese pendenti da categorizzare
    if (unsyncedExpenses.length > 0) {
      try {
        await sendWeeklyBulkCategoryReminder(unsyncedExpenses.length)
      } catch (error) {
        console.warn('[ExpenseSync] Failed to send weekly bulk category reminder:', error)
      }
    }
    
    let syncedCount = 0
    let errorCount = 0
    
    // Sincronizza ogni spesa
    for (const expense of unsyncedExpenses) {
      try {
        // Se abbiamo un category_id, usalo; altrimenti cerca la categoria memorizzata per lo stesso merchant
        let categoryId = expense.category_id
        
        if (!categoryId && expense.merchant) {
          // Prima cerca se esiste una categoria memorizzata per lo stesso merchant
          const { data: existingExpense } = await supabase
            .from('expenses')
            .select('category_id')
            .eq('user_id', userId)
            .eq('merchant', expense.merchant.trim())
            .not('category_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (existingExpense?.category_id) {
            // Usa la categoria memorizzata per questo merchant
            categoryId = existingExpense.category_id
            console.log(`[ExpenseSync] ✅ Found remembered category for merchant "${expense.merchant}": ${categoryId}`)
          }
        }
        
        // Se ancora non abbiamo una categoria, usa "Miscellaneous" come fallback
        if (!categoryId) {
          // Cerca la categoria "Miscellaneous" per l'utente
          let { data: miscellaneousCategory } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', userId)
            .eq('name', 'Miscellaneous')
            .single()
          
          if (!miscellaneousCategory) {
            // Se non esiste "Miscellaneous", cerca la prima categoria disponibile
            const { data: firstCategory } = await supabase
              .from('categories')
              .select('id')
              .eq('user_id', userId)
              .order('sort_order', { ascending: true })
              .limit(1)
              .single()
            
            if (firstCategory) {
              categoryId = firstCategory.id
            } else {
              // Se non ci sono categorie, crea "Miscellaneous"
              const { data: newCategory, error: createError } = await supabase
                .from('categories')
                .insert({
                  user_id: userId,
                  name: 'Miscellaneous',
                  icon: '📦',
                  color: '#8B5CF6',
                  sort_order: 999
                })
                .select('id')
                .single()
              
              if (createError || !newCategory) {
                console.warn('[ExpenseSync] Failed to create Miscellaneous category:', createError)
                errorCount++
                continue
              }
              
              categoryId = newCategory.id
            }
          } else {
            categoryId = miscellaneousCategory.id
          }
        }
        
        const expenseData: Omit<Expense, 'id' | 'created_at'> = {
          user_id: userId,
          amount: expense.amount,
          currency: expense.currency,
          merchant: expense.merchant,
          date: expense.date,
          raw_notification: expense.raw_notification || expense.description || '',
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
          // Duplicati: consenti SOLO la regola dei 2 secondi (nessuna finestra di 5 minuti)
          const now = new Date()
          const isDuplicate = existingExpenses.some(existing => {
            const existingTime = new Date(existing.created_at)
            const timeDiff = Math.abs(now.getTime() - existingTime.getTime())
            return timeDiff <= 2000 // 2 secondi in millisecondi
          })
          
          if (isDuplicate) {
            // Marca come sincronizzata anche se è un duplicato
            expense.synced = true
            continue
          }
        }
        
        const { error } = await supabase
          .from('expenses')
          .insert(expenseData)
        
        if (error) {
          console.error('[ExpenseSync] ❌ Error inserting expense:', error.message, expenseData)
          errorCount++
        } else {
          console.log(`[ExpenseSync] ✅ Expense synced: ${expense.merchant} - ${expense.amount}${expense.currency}`)
          // Marca come sincronizzata
          expense.synced = true
          syncedCount++
        }
      } catch (error: any) {
        console.error('[ExpenseSync] ❌ Exception while syncing expense:', error.message || error, expense)
        errorCount++
      }
    }
    
    // Salva le spese aggiornate (con flag synced=true)
    await writeAsStringAsync(expensesFile, JSON.stringify(pendingExpenses))
    
    // Pulizia automatica dei duplicati dopo la sincronizzazione
    if (syncedCount > 0) {
      await autoCleanupDuplicates(userId)
    }
    
    // Pulizia automatica delle spese pendenti più vecchie di 15 giorni
    await cleanOldPendingExpenses()
    
    // Sincronizza anche le entrate pendenti
    await syncPendingIncomes(userId)
    
    return { synced: syncedCount, errors: errorCount }
  } catch (error) {
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
    
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Pulisce le spese pendenti più vecchie di 15 giorni dalla cache
 */
export async function cleanOldPendingExpenses(): Promise<{ removed: number }> {
  try {
    const expensesFile = `${cacheDirectory}pending_expenses.json`
    
    let pendingExpenses: PendingExpense[] = []
    try {
      const data = await readAsStringAsync(expensesFile)
      pendingExpenses = JSON.parse(data)
    } catch (error) {
      return { removed: 0 }
    }
    
    if (pendingExpenses.length === 0) {
      return { removed: 0 }
    }
    
    // Calcola la data di 15 giorni fa
    const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000)
    
    // Filtra solo le spese più recenti di 15 giorni
    const initialCount = pendingExpenses.length
    const filteredExpenses = pendingExpenses.filter(expense => {
      // Mantieni le spese più recenti di 15 giorni
      return expense.timestamp > fifteenDaysAgo
    })
    
    const removedCount = initialCount - filteredExpenses.length
    
    if (removedCount > 0) {
      // Salva le spese filtrate
      await writeAsStringAsync(expensesFile, JSON.stringify(filteredExpenses))
      console.log(`[ExpenseSync] 🧹 Cleaned ${removedCount} old pending expenses (older than 15 days)`)
    }
    
    return { removed: removedCount }
  } catch (error) {
    console.error('[ExpenseSync] ❌ Error cleaning old pending expenses:', error)
    return { removed: 0 }
  }
}

/**
 * Rimuove i duplicati temporali esistenti dal database (differenza di 2 secondi)
 */
export async function removeTemporalDuplicates(userId: string): Promise<{ removed: number }> {
  try {
    
    // Trova tutte le spese dell'utente ordinate per created_at
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('id, amount, merchant, date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) {
      return { removed: 0 }
    }
    
    if (!expenses || expenses.length === 0) {
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
          }
        }
      }
    }
    
    return { removed: removedCount }
  } catch (error) {
    return { removed: 0 }
  }
}

/**
 * Pulisce tutti i duplicati esistenti nel database (temporali + identici)
 */
export async function cleanAllDuplicates(userId: string): Promise<{ removed: number }> {
  try {
    
    // Prima rimuovi i duplicati temporali
    const temporalResult = await removeTemporalDuplicates(userId)
    
    // Poi rimuovi i duplicati identici
    const regularResult = await removeDuplicateExpenses(userId)
    
    const totalRemoved = temporalResult.removed + regularResult.removed
    
    return { removed: totalRemoved }
  } catch (error) {
    return { removed: 0 }
  }
}

/**
 * Rimuove i duplicati esistenti dal database (inclusi quelli temporali)
 */
export async function removeDuplicateExpenses(userId: string): Promise<{ removed: number }> {
  try {
    
    // Prima rimuovi i duplicati temporali
    const temporalResult = await removeTemporalDuplicates(userId)
    
    // Poi rimuovi i duplicati normali
    
    // Trova duplicati basati su user_id, amount, merchant, date
    const { data: duplicates, error } = await supabase
      .from('expenses')
      .select('id, amount, merchant, date, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    
    if (error) {
      return { removed: 0 }
    }
    
    if (!duplicates || duplicates.length === 0) {
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
          }
        }
      }
    }
    
    const totalRemoved = temporalResult.removed + removedCount
    return { removed: totalRemoved }
  } catch (error) {
    return { removed: 0 }
  }
}

/**
 * Sincronizza le entrate pendenti dalla cache al database Supabase
 */
export async function syncPendingIncomes(userId: string): Promise<{ synced: number; errors: number }> {
  // Prevenire sincronizzazioni multiple simultanee
  if (isSyncingIncomes) {
    return { synced: 0, errors: 0 }
  }
  
  isSyncingIncomes = true
  
  try {
    const incomesFile = `${cacheDirectory}pending_incomes.json`
    
    // Leggi le entrate pendenti
    let pendingIncomes: PendingIncome[] = []
    try {
      const data = await readAsStringAsync(incomesFile)
      pendingIncomes = JSON.parse(data)
    } catch (error) {
      return { synced: 0, errors: 0 }
    }
    
    // Filtra solo le entrate non sincronizzate
    const unsyncedIncomes = pendingIncomes.filter(i => !i.synced)
    
    if (unsyncedIncomes.length === 0) {
      return { synced: 0, errors: 0 }
    }
    
    let syncedCount = 0
    let errorCount = 0
    
    // Sincronizza ogni entrata
    for (const income of unsyncedIncomes) {
      try {
        const incomeData = {
          user_id: userId,
          amount: income.amount,
          source: income.source || 'other',
          category: income.category || 'work',
          currency: income.currency || 'EUR',
          date: income.date,
          description: income.description || income.raw_notification || 'Accredito',
          is_recurring: false,
        }
        
        // Controlla se esiste già un'entrata identica (stesso amount, description, date)
        const { data: existingIncomes } = await supabase
          .from('incomes')
          .select('id, created_at')
          .eq('user_id', userId)
          .eq('amount', income.amount)
          .eq('description', incomeData.description)
          .eq('date', income.date)
          .order('created_at', { ascending: false })
        
        if (existingIncomes && existingIncomes.length > 0) {
          // Duplicati: consenti SOLO la regola dei 2 secondi
          const now = new Date()
          const isDuplicate = existingIncomes.some(existing => {
            const existingTime = new Date(existing.created_at)
            const timeDiff = Math.abs(now.getTime() - existingTime.getTime())
            return timeDiff <= 2000 // 2 secondi in millisecondi
          })
          
          if (isDuplicate) {
            // Marca come sincronizzata anche se è un duplicato
            income.synced = true
            continue
          }
        }
        
        const { error } = await supabase
          .from('incomes')
          .insert(incomeData)
        
        if (error) {
          console.error('[IncomeSync] ❌ Error inserting income:', error.message, incomeData)
          errorCount++
        } else {
          console.log(`[IncomeSync] ✅ Income synced: ${income.description} - ${income.amount}${income.currency}`)
          // Marca come sincronizzata
          income.synced = true
          syncedCount++
        }
      } catch (error: any) {
        console.error('[IncomeSync] ❌ Exception while syncing income:', error.message || error, income)
        errorCount++
      }
    }
    
    // Salva le entrate aggiornate (con flag synced=true)
    await writeAsStringAsync(incomesFile, JSON.stringify(pendingIncomes))
    
    return { synced: syncedCount, errors: errorCount }
  } catch (error) {
    return { synced: 0, errors: 1 }
  } finally {
    isSyncingIncomes = false
  }
}

/**
 * Pulisce le entrate sincronizzate dalla cache
 */
export async function cleanSyncedIncomes(): Promise<void> {
  try {
    const incomesFile = `${cacheDirectory}pending_incomes.json`
    
    const data = await readAsStringAsync(incomesFile)
    const pendingIncomes: PendingIncome[] = JSON.parse(data)
    
    // Mantieni solo le entrate non sincronizzate
    const unsyncedIncomes = pendingIncomes.filter(i => !i.synced)
    
    await writeAsStringAsync(incomesFile, JSON.stringify(unsyncedIncomes))
    
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Pulisce le entrate pendenti più vecchie di 15 giorni dalla cache
 */
export async function cleanOldPendingIncomes(): Promise<{ removed: number }> {
  try {
    const incomesFile = `${cacheDirectory}pending_incomes.json`
    
    let pendingIncomes: PendingIncome[] = []
    try {
      const data = await readAsStringAsync(incomesFile)
      pendingIncomes = JSON.parse(data)
    } catch (error) {
      return { removed: 0 }
    }
    
    if (pendingIncomes.length === 0) {
      return { removed: 0 }
    }
    
    // Calcola la data di 15 giorni fa
    const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000)
    
    // Filtra solo le entrate più recenti di 15 giorni
    const initialCount = pendingIncomes.length
    const filteredIncomes = pendingIncomes.filter(income => {
      // Mantieni le entrate più recenti di 15 giorni
      return income.timestamp > fifteenDaysAgo
    })
    
    const removedCount = initialCount - filteredIncomes.length
    
    if (removedCount > 0) {
      // Salva le entrate filtrate
      await writeAsStringAsync(incomesFile, JSON.stringify(filteredIncomes))
      console.log(`[IncomeSync] 🧹 Cleaned ${removedCount} old pending incomes (older than 15 days)`)
    }
    
    return { removed: removedCount }
  } catch (error) {
    console.error('[IncomeSync] ❌ Error cleaning old pending incomes:', error)
    return { removed: 0 }
  }
}

