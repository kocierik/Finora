export type CategoryDefinition = {
  key: string
  name: string
  icon: string
  color: string
}

// App default 8 categories
export const DEFAULT_CATEGORY_COLOR = '#06b6d4' // colore unico per tutte le categorie
export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { key: 'groceries', name: 'Spesa', icon: '🛒', color: DEFAULT_CATEGORY_COLOR },
  { key: 'eating_coffee', name: 'Mangiare / Caffè', icon: '🍕', color: DEFAULT_CATEGORY_COLOR },
  { key: 'transport', name: 'Trasporti', icon: '🚗', color: DEFAULT_CATEGORY_COLOR },
  { key: 'home_bills', name: 'Casa & Bollette', icon: '🏠', color: DEFAULT_CATEGORY_COLOR },
  { key: 'shopping', name: 'Shopping', icon: '🛍️', color: DEFAULT_CATEGORY_COLOR },
  { key: 'entertainment', name: 'Intrattenimento', icon: '🎬', color: DEFAULT_CATEGORY_COLOR },
  { key: 'personal_care', name: 'Cura Personale', icon: '🏥', color: DEFAULT_CATEGORY_COLOR },
  { key: 'miscellaneous', name: 'Varie', icon: '📦', color: DEFAULT_CATEGORY_COLOR },
]

export const PREDEFINED_CATEGORIES_MAP: Map<string, CategoryDefinition> = new Map(
  DEFAULT_CATEGORIES.map((c) => [c.name.toLowerCase(), c])
)

export function translateCategoryName(name: string, language: 'it' | 'en'): string {
  // Ora che i nomi sono già in italiano di default, non serve più tradurre verso l'italiano
  // se il nome corrisponde già. Mantengo per compatibilità con vecchi dati.
  if (language !== 'it') return name
  const key = (name || '').toLowerCase()
  switch (key) {
    case 'miscellaneous': return 'Varie'
    case 'personal care': return 'Cura Personale'
    case 'entertainment': return 'Intrattenimento'
    case 'eating_coffe': 
    case 'eating / coffee': return 'Mangiare / Caffè'
    case 'transport': return 'Trasporti'
    case 'groceries': 
    case 'grocery': return 'Spesa'
    case 'home & utilities':
    case 'home & bills': return 'Casa & Bollette'
    case 'shopping': return 'Shopping'
    default: return name
  }
}

