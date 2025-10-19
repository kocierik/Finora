import { cacheDirectory, readAsStringAsync } from 'expo-file-system/legacy'
import { sendWeeklyBulkCategoryReminder } from './category-reminder'
import { shouldSendWeeklyBulkReminder } from './notification-tracking'

/**
 * Controlla se ci sono spese pendenti e invia il reminder settimanale se necessario
 */
export async function checkAndSendWeeklyReminder(): Promise<void> {
  try {
    // Conta le spese pendenti
    const expensesFile = `${cacheDirectory}pending_expenses.json`
    let pendingExpenses = []
    
    try {
      const data = await readAsStringAsync(expensesFile)
      pendingExpenses = JSON.parse(data)
    } catch (error) {
      console.log('[WeeklyReminderScheduler] No pending expenses file found')
      return
    }
    
    const unsyncedCount = pendingExpenses.filter((e: any) => !e.synced).length
    
    if (unsyncedCount === 0) {
      console.log('[WeeklyReminderScheduler] No pending expenses found, skipping reminder')
      return
    }

    // Controlla se dovrebbe inviare il reminder settimanale
    const shouldSend = await shouldSendWeeklyBulkReminder()
    if (!shouldSend) {
      console.log('[WeeklyReminderScheduler] Skipping weekly reminder - already sent this week')
      return
    }
    
    console.log(`[WeeklyReminderScheduler] Found ${unsyncedCount} pending expenses, sending weekly reminder`)
    await sendWeeklyBulkCategoryReminder(unsyncedCount)
  } catch (error) {
    console.error('[WeeklyReminderScheduler] Error checking and sending weekly reminder:', error)
  }
}

/**
 * Avvia il controllo periodico per il reminder settimanale
 * Questo dovrebbe essere chiamato all'avvio dell'app
 */
export function startWeeklyReminderScheduler(): void {
  // Controlla immediatamente
  checkAndSendWeeklyReminder()
  
  // Poi controlla ogni 12 ore (ridotto da 6 ore per evitare log eccessivi)
  setInterval(() => {
    checkAndSendWeeklyReminder()
  }, 12 * 60 * 60 * 1000) // 12 ore in millisecondi
}
