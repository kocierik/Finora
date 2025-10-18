import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

/**
 * Hook per sincronizzare le impostazioni con il database
 */
export function useDatabaseSync() {
  const { user } = useAuth()
  const { 
    monthlyBudget, 
    currency, 
    hideBalances, 
    setMonthlyBudget, 
    setCurrency, 
    setHideBalances,
  } = useSettings()

  // Carica le impostazioni dal database quando l'utente cambia
  useEffect(() => {
    if (!user) return

    const loadFromDatabase = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('monthly_budget, currency, hide_balances')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.log('[DatabaseSync] ❌ Error loading from database:', error.message)
          return
        }
        
        if (data) {
          if (data.monthly_budget !== null) setMonthlyBudget(Number(data.monthly_budget))
          if (data.currency) setCurrency(data.currency)
          if (typeof data.hide_balances === 'boolean') setHideBalances(data.hide_balances)
          console.log('[DatabaseSync] ✅ Loaded settings from database:', data)
        }
      } catch (error) {
        console.log('[DatabaseSync] ❌ Error syncing with database:', error)
      }
    }

    loadFromDatabase()
  }, [user, setMonthlyBudget, setCurrency, setHideBalances])

  // Salva le impostazioni nel database quando cambiano
  useEffect(() => {
    if (!user) return

    const saveToDatabase = async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            monthly_budget: monthlyBudget,
            currency: currency,
            hide_balances: hideBalances,
            updated_at: new Date().toISOString()
          })
        
        if (error) {
          console.log('[DatabaseSync] ❌ Error saving to database:', error.message)
        } else {
          console.log('[DatabaseSync] ✅ Settings saved to database')
        }
      } catch (error) {
        console.log('[DatabaseSync] ❌ Error saving settings:', error)
      }
    }

    // Debounce per evitare troppi salvataggi
    const timeoutId = setTimeout(saveToDatabase, 1000)
    return () => clearTimeout(timeoutId)
  }, [user, monthlyBudget, currency, hideBalances])
}
