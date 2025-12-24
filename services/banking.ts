import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';

export interface BankConnection {
  id: string;
  bank_name: string;
  status: string;
  access_expires_at: string;
  created_at: string;
}

/**
 * Inizializza il processo di collegamento bancario
 */
export async function initiateBankConnection(bankId: string, country: string = 'IT') {
  try {
    // 1. Chiama la Edge Function per ottenere l'URL di autorizzazione
    const { data, error } = await supabase.functions.invoke('bank-connect', {
      body: { bank_id: bankId, country } 
    });

    if (error) throw error;
    if (!data?.url) throw new Error('Nessun URL di redirect ricevuto');

    // 2. Apri il browser per l'autenticazione
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      'com.kocierik.finora://bank-callback'
    );

    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const status = url.searchParams.get('status');
      
      if (status === 'error') {
        const message = url.searchParams.get('message');
        throw new Error(message || 'Errore durante il collegamento bancario');
      }
      
      return { success: true };
    }
    
    return { success: false, cancelled: true };
  } catch (error) {
    console.error('[BankingService] ❌ Errore in initiateBankConnection:', error);
    throw error;
  }
}

export async function listBanks(country: string = 'IT'): Promise<Array<{ name: string; country: string }>> {
  const { data, error } = await supabase.functions.invoke('bank-aspsps', {
    body: { country }
  })
  if (error) throw error
  return data?.aspsps || []
}

/**
 * Sincronizza le transazioni per tutti i conti collegati dell'utente
 */
export async function syncBankTransactions() {
  try {
    const { data, error } = await supabase.functions.invoke('sync-transactions');
    if (error) throw error;
    
    // Assicuriamoci di restituire un oggetto coerente
    return {
      success: data?.success || false,
      synced: typeof data?.synced === 'number' ? data.synced : 0
    };
  } catch (error) {
    console.error('[BankingService] ❌ Errore in syncBankTransactions:', error);
    throw error;
  }
}

/**
 * Recupera le connessioni bancarie attive dell'utente
 */
export async function getBankConnections(): Promise<BankConnection[]> {
  const { data, error } = await supabase
    .from('bank_connections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[BankingService] ❌ Errore in getBankConnections:', error);
    return [];
  }

  return data || [];
}

/**
 * Rimuove una connessione bancaria
 */
export async function disconnectBank(connectionId: string) {
  const { error } = await supabase
    .from('bank_connections')
    .delete()
    .eq('id', connectionId);

  if (error) {
    console.error('[BankingService] ❌ Errore in disconnectBank:', error);
    throw error;
  }
}
