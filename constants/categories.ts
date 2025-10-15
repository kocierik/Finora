export type CategoryDefinition = {
  key: string
  name: string
  icon: string
  color: string
}

// App default 6 categories (used for initial profile/settings)
export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { key: 'other', name: 'Other', icon: '📦', color: '#10b981' },
  { key: 'transport', name: 'Transport', icon: '🚗', color: '#06b6d4' },
  { key: 'grocery', name: 'Grocery', icon: '🛒', color: '#8b5cf6' },
  { key: 'shopping', name: 'Shopping', icon: '🛍️', color: '#f59e0b' },
  { key: 'night_life', name: 'Night Life', icon: '🌃', color: '#ef4444' },
  { key: 'travel', name: 'Travel', icon: '✈️', color: '#3b82f6' },
]

export const PREDEFINED_CATEGORIES_MAP: Map<string, CategoryDefinition> = new Map(
  DEFAULT_CATEGORIES.map((c) => [c.name.toLowerCase(), c])
)

export function translateCategoryName(name: string, language: 'it' | 'en'): string {
  if (language !== 'it') return name
  const key = (name || '').toLowerCase()
  switch (key) {
    case 'other': return 'Altro'
    case 'transport': return 'Trasporti'
    case 'grocery': return 'Spesa'
    case 'shopping': return 'Shopping'
    case 'night life': return 'Vita notturna'
    case 'travel': return 'Viaggi'
    case 'healthcare': return 'Sanità'
    case 'education': return 'Istruzione'
    case 'utilities': return 'Utenze'
    case 'entertainment': return 'Intrattenimento'
    default: return name
  }
}

