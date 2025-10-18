export type CategoryDefinition = {
  key: string
  name: string
  icon: string
  color: string
}

// App default 6 categories (used for initial profile/settings)
export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { key: 'miscellaneous', name: 'Miscellaneous', icon: '🎁', color: '#EC4899' },
  { key: 'personal_care', name: 'Personal Care', icon: '🛍️', color: '#8B5CF6' },
  { key: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#06b6d4' },
  { key: 'eating_coffe', name: 'Eating / Coffee', icon: '🍕', color: '#EC4899' },
  { key: 'transport', name: 'Transport', icon: '🚗', color: '#8b5cf6' },
  { key: 'groceries', name: 'Grocery', icon: '🛒', color: '#f59e0b' },
]

export const PREDEFINED_CATEGORIES_MAP: Map<string, CategoryDefinition> = new Map(
  DEFAULT_CATEGORIES.map((c) => [c.name.toLowerCase(), c])
)

export function translateCategoryName(name: string, language: 'it' | 'en'): string {
  if (language !== 'it') return name
  const key = (name || '').toLowerCase()
  switch (key) {
    case 'miscellaneous': return 'Varie'
    case 'personal care': return 'Cura Personale'
    case 'entertainment': return 'Intrattenimento'
    case 'eating_coffe': return 'Mangiare / Caffè'
    case 'transport': return 'Trasporti'
    case 'groceries': return 'Spesa'
    default: return name
  }
}

