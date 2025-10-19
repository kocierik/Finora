import { supabase } from '@/lib/supabase'
import { CategoryAction } from './interactive-notifications'

/**
 * Ottiene le categorie dell'utente per le notifiche interattive
 */
export async function getUserCategoriesForNotifications(userId: string): Promise<CategoryAction[]> {
  try {
    // Valida che l'userId sia un UUID valido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      console.warn('[UserCategories] Invalid userId format, using default categories')
      return getDefaultCategories()
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id, name, icon, color')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .limit(6) // Limita a 6 categorie per le notifiche

    if (error) {
      console.error('[UserCategories] Error fetching user categories:', error)
      return getDefaultCategories()
    }

    if (!data || data.length === 0) {
      return getDefaultCategories()
    }

    return data.map(category => ({
      id: category.id,
      title: category.name,
      icon: category.icon,
      color: category.color
    }))
  } catch (error) {
    console.error('[UserCategories] Error fetching user categories:', error)
    return getDefaultCategories()
  }
}

/**
 * Categorie di default se l'utente non ha categorie personalizzate
 */
function getDefaultCategories(): CategoryAction[] {
  return [
    { id: 'default_food', title: 'Cibo', icon: '🍽️', color: '#F59E0B' },
    { id: 'default_transport', title: 'Trasporti', icon: '🚗', color: '#10B981' },
    { id: 'default_entertainment', title: 'Intrattenimento', icon: '🎬', color: '#EF4444' },
    { id: 'default_other', title: 'Altro', icon: '📦', color: '#8B5CF6' }
  ]
}

/**
 * Ottiene le categorie più utilizzate per le notifiche interattive
 */
export async function getMostUsedCategoriesForNotifications(userId: string): Promise<CategoryAction[]> {
  try {
    // Ottieni le categorie più utilizzate negli ultimi 30 giorni
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        category_id,
        categories!inner(id, name, icon, color),
        count:amount.count()
      `)
      .eq('user_id', userId)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .not('category_id', 'is', null)
      .order('count', { ascending: false })
      .limit(4)

    if (error) {
      console.error('[UserCategories] Error fetching most used categories:', error)
      return getUserCategoriesForNotifications(userId)
    }

    if (!data || data.length === 0) {
      return getUserCategoriesForNotifications(userId)
    }

    return data.map(item => ({
      id: item.categories.id,
      title: item.categories.name,
      icon: item.categories.icon,
      color: item.categories.color
    }))
  } catch (error) {
    console.error('[UserCategories] Error fetching most used categories:', error)
    return getUserCategoriesForNotifications(userId)
  }
}
