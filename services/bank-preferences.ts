import AsyncStorage from '@react-native-async-storage/async-storage'

export type BankConfig = {
  id: string
  name: string
  icon: string
  packageNames: string[] // Array di possibili package names da controllare
  keywords: string[] // Parole chiave da cercare nel package name
}

export const AVAILABLE_BANKS: BankConfig[] = [
  {
    id: 'google_wallet',
    name: 'Google Wallet',
    icon: '💳',
    packageNames: ['com.google.android.apps.wallet', 'com.google.android.apps.walletnfcrel'],
    keywords: ['wallet']
  },
  {
    id: 'revolut',
    name: 'Revolut',
    icon: '🏦',
    packageNames: ['com.revolut.revolut'],
    keywords: ['revolut']
  },
  {
    id: 'n26',
    name: 'N26',
    icon: '🏦',
    packageNames: ['de.number26.android'],
    keywords: ['n26']
  },
  {
    id: 'hype',
    name: 'Hype',
    icon: '🏦',
    packageNames: ['it.banca.hype'],
    keywords: ['hype']
  },
  {
    id: 'bbva',
    name: 'BBVA',
    icon: '🏦',
    packageNames: ['com.bbva.bbvacontigo', 'com.bbva.mx.bbvacontigo'],
    keywords: ['bbva']
  },
  {
    id: 'intesa_sanpaolo',
    name: 'Intesa Sanpaolo',
    icon: '🏦',
    packageNames: ['com.intesasanpaolo.isp'],
    keywords: ['intesa', 'sanpaolo']
  },
  {
    id: 'unicredit',
    name: 'UniCredit',
    icon: '🏦',
    packageNames: ['com.unicreditgroup.mobile'],
    keywords: ['unicredit']
  },
  {
    id: 'fineco',
    name: 'Fineco',
    icon: '🏦',
    packageNames: ['it.fineco.bank'],
    keywords: ['fineco']
  },
  {
    id: 'wise',
    name: 'Wise',
    icon: '🏦',
    packageNames: ['com.transferwise.android'],
    keywords: ['wise', 'transferwise']
  },
  {
    id: 'monzo',
    name: 'Monzo',
    icon: '🏦',
    packageNames: ['com.getmondo'],
    keywords: ['monzo']
  },
  {
    id: 'illimity',
    name: 'Illimity',
    icon: '🏦',
    packageNames: ['com.illimity.bank'],
    keywords: ['illimity']
  },
  {
    id: 'widiba',
    name: 'Widiba',
    icon: '🏦',
    packageNames: ['com.widiba.mobile'],
    keywords: ['widiba']
  },
  {
    id: 'banca_sella',
    name: 'Banca Sella',
    icon: '🏦',
    packageNames: ['it.bancasella.mobile'],
    keywords: ['sella']
  },
  {
    id: 'banco_bpm',
    name: 'Banco BPM',
    icon: '🏦',
    packageNames: ['com.bancobpm.mobile'],
    keywords: ['banco', 'bpm']
  },
  {
    id: 'bper',
    name: 'BPER Banca',
    icon: '🏦',
    packageNames: ['com.bper.mobile'],
    keywords: ['bper']
  }
]

const STORAGE_KEY = '@finora:monitored_banks'

/**
 * Carica le banche monitorate dallo storage
 * Default: solo Google Wallet abilitato
 */
export async function loadMonitoredBanks(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Valida che siano IDs validi
      const validIds = AVAILABLE_BANKS.map(b => b.id)
      return parsed.filter((id: string) => validIds.includes(id))
    }
    // Default: solo Google Wallet
    return ['google_wallet']
  } catch (error) {
    console.log('[BankPreferences] ❌ Error loading monitored banks:', error)
    return ['google_wallet']
  }
}

/**
 * Salva le banche monitorate nello storage
 */
export async function saveMonitoredBanks(bankIds: string[]): Promise<void> {
  try {
    // Valida che siano IDs validi
    const validIds = AVAILABLE_BANKS.map(b => b.id)
    const validBankIds = bankIds.filter(id => validIds.includes(id))
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validBankIds))
  } catch (error) {
    console.log('[BankPreferences] ❌ Error saving monitored banks:', error)
    throw error
  }
}

/**
 * Verifica se una notifica proviene da una banca monitorata
 */
export async function isMonitoredBank(notificationPackage: string): Promise<boolean> {
  try {
    const appPackageLower = notificationPackage.toLowerCase()
    
    // First, always check for Google Wallet explicitly (fallback)
    const isGoogleWallet = appPackageLower.includes('com.google.android.apps.wallet') ||
                          appPackageLower.includes('com.google.android.apps.walletnfcrel') ||
                          appPackageLower === 'wallet' ||
                          (appPackageLower.includes('wallet') && appPackageLower.includes('google'))
    
    if (isGoogleWallet) {
      return true
    }
    
    const monitoredBanks = await loadMonitoredBanks()
    
    for (const bankId of monitoredBanks) {
      const bank = AVAILABLE_BANKS.find(b => b.id === bankId)
      if (!bank) continue
      
      // Controlla package names esatti (exact match or contains)
      for (const packageName of bank.packageNames) {
        const packageLower = packageName.toLowerCase()
        if (appPackageLower === packageLower || appPackageLower.includes(packageLower)) {
          return true
        }
      }
      
      // Controlla keywords
      for (const keyword of bank.keywords) {
        if (appPackageLower.includes(keyword.toLowerCase())) {
          return true
        }
      }
    }
    
    // Fallback: se contiene "wallet", assume Google Wallet
    if (appPackageLower.includes('wallet')) {
      return true
    }
    
    return false
  } catch (error) {
    console.log('[BankPreferences] ❌ Error checking monitored bank:', error)
    // Default: controlla solo wallet per retrocompatibilità
    return notificationPackage.toLowerCase().includes('wallet')
  }
}

/**
 * Ottiene la configurazione della banca da un package name
 */
export function getBankFromPackage(packageName: string): BankConfig | undefined {
  const packageLower = packageName.toLowerCase()
  
  for (const bank of AVAILABLE_BANKS) {
    // Controlla package names esatti
    for (const bankPackage of bank.packageNames) {
      if (packageLower.includes(bankPackage.toLowerCase())) {
        return bank
      }
    }
    
    // Controlla keywords
    for (const keyword of bank.keywords) {
      if (packageLower.includes(keyword.toLowerCase())) {
        return bank
      }
    }
  }
  
  return undefined
}

