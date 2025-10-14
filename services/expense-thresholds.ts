import { supabase } from '@/lib/supabase'
import { cacheDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy'

export interface ExpenseThresholds {
  moderate: number  // Soglia per spesa moderata (default: 1000)
  high: number      // Soglia per spesa elevata (default: 1500)
}

export type ExpenseLevel = 'low' | 'moderate' | 'high'

const THRESHOLDS_CACHE_FILE = `${cacheDirectory}expense_thresholds.json`
const DEFAULT_THRESHOLDS: ExpenseThresholds = {
  moderate: 1000,
  high: 1500
}

/**
 * Carica le soglie delle spese dal database
 */
export async function loadExpenseThresholds(userId?: string): Promise<ExpenseThresholds> {
  try {
    if (userId) {
      // Carica dal database
      const { data, error } = await supabase
        .from('profiles')
        .select('expense_threshold_moderate, expense_threshold_high')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.log('[ExpenseThresholds] ❌ Error loading from database:', error.message)
        return await loadFromCache()
      }
      
      if (data && data.expense_threshold_moderate && data.expense_threshold_high) {
        const thresholds = {
          moderate: Number(data.expense_threshold_moderate),
          high: Number(data.expense_threshold_high)
        }
        
        // Valida le soglie
        if (thresholds.moderate > 0 && thresholds.high > 0 && thresholds.moderate < thresholds.high) {
          console.log('[ExpenseThresholds] 📂 Loaded thresholds from database:', thresholds)
          return thresholds
        }
      }
    }
    
    // Fallback alla cache locale
    return await loadFromCache()
  } catch (error) {
    console.log('[ExpenseThresholds] ❌ Error loading thresholds:', error)
    return await loadFromCache()
  }
}

/**
 * Carica le soglie dalla cache locale (fallback)
 */
async function loadFromCache(): Promise<ExpenseThresholds> {
  try {
    const fileInfo = await readAsStringAsync(THRESHOLDS_CACHE_FILE)
    const thresholds = JSON.parse(fileInfo)
    
    // Valida che le soglie siano numeri positivi e moderate < high
    if (typeof thresholds.moderate === 'number' && 
        typeof thresholds.high === 'number' &&
        thresholds.moderate > 0 && 
        thresholds.high > 0 &&
        thresholds.moderate < thresholds.high) {
      console.log('[ExpenseThresholds] 📂 Loaded thresholds from cache:', thresholds)
      return thresholds
    } else {
      console.log('[ExpenseThresholds] ⚠️  Invalid thresholds in cache, using defaults')
      return DEFAULT_THRESHOLDS
    }
  } catch (error) {
    console.log('[ExpenseThresholds] 📂 No thresholds cache found, using defaults')
    return DEFAULT_THRESHOLDS
  }
}

/**
 * Salva le soglie delle spese nel database e nella cache
 */
export async function saveExpenseThresholds(thresholds: ExpenseThresholds, userId?: string): Promise<void> {
  try {
    // Valida le soglie
    if (thresholds.moderate <= 0 || thresholds.high <= 0 || thresholds.moderate >= thresholds.high) {
      throw new Error('Invalid thresholds: moderate must be > 0, high must be > moderate')
    }
    
    // Salva nel database se userId è fornito
    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          expense_threshold_moderate: thresholds.moderate,
          expense_threshold_high: thresholds.high,
          updated_at: new Date().toISOString()
        })
      
      if (error) {
        console.log('[ExpenseThresholds] ❌ Error saving to database:', error.message)
        // Continua con il salvataggio in cache come fallback
      } else {
        console.log('[ExpenseThresholds] ✅ Thresholds saved to database:', thresholds)
      }
    }
    
    // Salva sempre nella cache locale come backup
    await writeAsStringAsync(THRESHOLDS_CACHE_FILE, JSON.stringify(thresholds))
    console.log('[ExpenseThresholds] ✅ Thresholds saved to cache:', thresholds)
  } catch (error: any) {
    console.error('[ExpenseThresholds] ❌ Error saving thresholds:', error.message)
    throw error
  }
}

/**
 * Determina il livello di spesa basato sull'importo e le soglie
 */
export function getExpenseLevel(amount: number, thresholds: ExpenseThresholds): ExpenseLevel {
  if (amount >= thresholds.high) {
    return 'high'
  } else if (amount >= thresholds.moderate) {
    return 'moderate'
  } else {
    return 'low'
  }
}

/**
 * Ottiene il colore per il livello di spesa
 */
export function getExpenseLevelColor(level: ExpenseLevel): string {
  switch (level) {
    case 'high':
      return '#ef4444' // Rosso
    case 'moderate':
      return '#f59e0b' // Arancione
    case 'low':
      return '#10b981' // Verde
    default:
      return '#10b981'
  }
}

/**
 * Ottiene il testo per il livello di spesa
 */
export function getExpenseLevelText(level: ExpenseLevel): string {
  switch (level) {
    case 'high':
      return 'Spesa elevata'
    case 'moderate':
      return 'Spesa moderata'
    case 'low':
      return 'Spesa contenuta'
    default:
      return 'Spesa contenuta'
  }
}

/**
 * Ottiene il testo per il livello di spesa in inglese (per i log)
 */
export function getExpenseLevelTextEn(level: ExpenseLevel): string {
  switch (level) {
    case 'high':
      return 'High spending'
    case 'moderate':
      return 'Moderate spending'
    case 'low':
      return 'Low spending'
    default:
      return 'Low spending'
  }
}

/**
 * Calcola la percentuale di riempimento della barra di attività
 */
export function calculateActivityPercentage(amount: number, thresholds: ExpenseThresholds): number {
  // Usa la soglia alta come riferimento per il 100%
  return Math.min(100, (amount / thresholds.high) * 100)
}
