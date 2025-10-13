import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type LanguageCode = 'it' | 'en'

type Settings = {
  language: LanguageCode
  locale: string
  currency: string
  hideBalances: boolean
  monthlyBudget: number | null
  enableBiometrics: boolean
  sessionTimeoutMinutes: number
  t: (key: string, params?: Record<string, any>) => string
  setLanguage: (lang: LanguageCode) => void
  setLocale: (loc: string) => void
  setCurrency: (cur: string) => void
  setHideBalances: (v: boolean) => void
  setMonthlyBudget: (v: number | null) => void
  setEnableBiometrics: (v: boolean) => void
  setSessionTimeoutMinutes: (v: number) => void
}

const SettingsContext = createContext<Settings | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('it')
  const [locale, setLocale] = useState<string>('it-IT')
  const [currency, setCurrency] = useState<string>('EUR')
  const [hideBalances, setHideBalances] = useState<boolean>(false)
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null)
  const [enableBiometrics, setEnableBiometrics] = useState<boolean>(false)
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(15)

  // Load persisted settings once
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@finora:settings')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed.language) setLanguage(parsed.language)
          if (parsed.locale) setLocale(parsed.locale)
          if (parsed.currency) setCurrency(parsed.currency)
          if (typeof parsed.hideBalances === 'boolean') setHideBalances(parsed.hideBalances)
          if (typeof parsed.monthlyBudget === 'number') setMonthlyBudget(parsed.monthlyBudget)
          if (typeof parsed.enableBiometrics === 'boolean') setEnableBiometrics(parsed.enableBiometrics)
          if (typeof parsed.sessionTimeoutMinutes === 'number') setSessionTimeoutMinutes(parsed.sessionTimeoutMinutes)
        } else {
          // No stored settings: detect device language and default to EN unless Italian
          const navLang = (typeof navigator !== 'undefined' && (navigator as any).language) ? (navigator as any).language : 'en-US'
          if ((navLang || '').toLowerCase().startsWith('it')) {
            setLanguage('it')
            setLocale('it-IT')
          } else {
            setLanguage('en')
            setLocale('en-US')
          }
        }
      } catch {}
    })()
  }, [])

  // Persist on change
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(
          '@finora:settings',
          JSON.stringify({ language, locale, currency, hideBalances, monthlyBudget, enableBiometrics, sessionTimeoutMinutes })
        )
      } catch {}
    }
    save()
  }, [language, locale, currency, hideBalances, monthlyBudget, enableBiometrics, sessionTimeoutMinutes])

  const value = useMemo<Settings>(() => ({
    language,
    locale,
    currency,
    hideBalances,
    monthlyBudget,
    enableBiometrics,
    sessionTimeoutMinutes,
    t: (key: string, params?: Record<string, any>) => {
      const i18n: Record<LanguageCode, Record<string, string>> = {
        it: {
          monthly_expenses: 'Spese Mensili',
          this_month: 'Questo mese',
          vs_last_month: 'vs mese scorso',
          recent_transactions: 'Transazioni recenti',
          transaction: 'transazione',
          transactions: 'transazioni',
          loading: 'Caricamento...',
          unauthorized: 'Accesso non autorizzato',
          login_continue: 'Effettua il login per continuare',
          add: 'Aggiungi',
          add_transaction: 'Aggiungi Transazione',
          saving: 'Salvataggio…',
          amount: 'Importo',
          category: 'Categoria',
          monthly_distribution: 'Distribuzione mensile',
          title: 'Titolo',
          date: 'Data',
          select_date: 'Seleziona Data',
          close: 'Chiudi',
          good_morning: 'Buongiorno',
          good_afternoon: 'Buon pomeriggio',
          good_evening: 'Buonasera',
          select_category: 'Seleziona Categoria',
          no_expenses: 'Nessuna spesa registrata',
          wallet_auto: 'Le spese da Google Wallet verranno aggiunte automaticamente',
          account_settings: 'Impostazioni Account',
          financial_settings: 'Impostazioni Finanziarie',
          name: 'Nome',
          email_address: 'Indirizzo Email',
          save_changes: 'Salva Modifiche',
          saving_changes: 'Salvataggio...'
          ,delete_transaction: 'Elimina Transazione'
          ,delete_confirm_text: 'Sei sicuro di voler eliminare questa transazione?'
          ,cancel: 'Annulla'
          ,delete: 'Elimina'
          ,app_actions: 'Azioni App'
          ,notifications: 'Notifiche'
          ,notifications_desc: 'Vedi e gestisci le notifiche delle transazioni'
          ,security: 'Sicurezza'
          ,security_desc: 'Gestisci autenticazione e impostazioni di sicurezza'
          ,support: 'Aiuto e Supporto'
          ,support_desc: 'FAQ, contatti e invio feedback'
          ,support_email_label: 'Email'
          ,language_formats: 'Lingua e Formati'
          ,language_label: 'Lingua'
          ,save_thresholds: 'Salva Soglie'
          ,profile_updated_success: 'Profilo aggiornato con successo!'
          ,thresholds_updated_success: 'Soglie delle spese aggiornate con successo!'
          ,thresholds_save_error_generic: 'Impossibile salvare le soglie'
          ,error_prefix: 'Errore: '
          ,forgot_password: 'Password dimenticata?'
          ,reset_password_title: 'Reimposta password'
          ,reset_password_enter_email: 'Inserisci una email valida per procedere'
          ,reset_password_link_sent: 'Ti abbiamo inviato un link per reimpostare la password'
        },
        en: {
          monthly_expenses: 'Monthly Expenses',
          this_month: 'This month',
          vs_last_month: 'vs last month',
          recent_transactions: 'Recent transactions',
          loading: 'Loading...',
          transaction: 'transaction',
          transactions: 'transactions',
          unauthorized: 'Unauthorized',
          login_continue: 'Please log in to continue',
          add: 'Add',
          add_transaction: 'Add Transaction',
          saving: 'Saving…',
          amount: 'Amount',
          category: 'Category',
          title: 'Title',
          date: 'Date',
          select_date: 'Select Date',
          close: 'Close',
          good_morning: 'Good morning',
          good_afternoon: 'Good afternoon',
          good_evening: 'Good evening',
          select_category: 'Select Category',
          no_expenses: 'No expenses recorded',
          wallet_auto: 'Expenses from Google Wallet will be added automatically',
          account_settings: 'Account Settings',
          financial_settings: 'Financial Settings',
          name: 'Name',
          email_address: 'Email Address',
          save_changes: 'Save Changes',
          saving_changes: 'Saving...'
          ,delete_transaction: 'Delete Transaction'
          ,delete_confirm_text: 'Are you sure you want to delete this transaction?'
          ,cancel: 'Cancel'
          ,delete: 'Delete'
          ,app_actions: 'App Actions'
          ,notifications: 'Notifications'
          ,notifications_desc: 'View and manage transaction notifications'
          ,security: 'Security'
          ,security_desc: 'Manage authentication and security settings'
          ,support: 'Help & Support'
          ,support_desc: 'FAQ, contacts and feedback'
          ,support_email_label: 'Email'
          ,language_formats: 'Language & Formats'
          ,language_label: 'Language'
          ,save_thresholds: 'Save Thresholds'
          ,profile_updated_success: 'Profile updated successfully!'
          ,thresholds_updated_success: 'Expense thresholds updated successfully!'
          ,thresholds_save_error_generic: 'Unable to save thresholds'
          ,error_prefix: 'Error: '
          ,forgot_password: 'Forgot password?'
          ,reset_password_title: 'Reset password'
          ,reset_password_enter_email: 'Enter a valid email to proceed'
          ,reset_password_link_sent: 'We sent you a link to reset your password'
        }
      }
      const dict = i18n[language] || i18n.it
      return dict[key] ?? key
    },
    setLanguage,
    setLocale,
    setCurrency,
    setHideBalances,
    setMonthlyBudget,
    setEnableBiometrics,
    setSessionTimeoutMinutes,
  }), [language, locale, currency, hideBalances, monthlyBudget, enableBiometrics, sessionTimeoutMinutes])

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}


