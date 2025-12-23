export function isPromotionalNotification(title: string, text: string): boolean {
  const fullText = (title + ' ' + text).toLowerCase()

  const promotionalKeywords = [
    /invita\s+(un\s+)?amico/i,
    /invite\s+(a\s+)?friend/i,
    /ricevi\s+\d+.*(?:invitando|se\s+inviti)/i,
    /ricevi\s+\d+.*(?:per\s+ogni|per\s+ciascun)/i,
    /offerta\s+promozionale/i,
    /promozione\s+special/i,
    /bonus\s+benvenuto/i,
    /welcome\s+bonus/i,
    /vinci\s+\d+/i,
    /win\s+\d+/i,
    /premio\s+di\s+\d+/i,
    /prize\s+of\s+\d+/i,
    /iscriviti\s+e\s+ricevi/i,
    /subscribe\s+and\s+receive/i,
    /nuovo\s+cliente/i,
    /new\s+customer/i,
    /codice\s+promozionale/i,
    /promotional\s+code/i,
    /cashback.*(?:se\s+inviti|invitando)/i,
    /referral\s+program/i,
    /programma\s+referral/i,
    /condividi\s+e\s+ricevi/i,
    /share\s+and\s+receive/i,
    /ottieni\s+\d+.*(?:invitando|se\s+inviti)/i,
    /get\s+\d+.*(?:inviting|if\s+you\s+invite)/i,
  ]

  const realTransactionKeywords = [
    /pagamento\s+effettuato/i,
    /payment\s+made/i,
    /accredito\s+ricevuto/i,
    /credit\s+received/i,
    /bonifico/i,
    /transfer/i,
    /addebito/i,
    /debit/i,
    /prelievo/i,
    /withdrawal/i,
    /storno/i,
    /refund/i,
    /rimborso/i,
    /ricevuto\s+da/i,
    /received\s+from/i,
    /pagato\s+a/i,
    /paid\s+to/i,
    /transazione/i,
    /transaction/i,
  ]

  const hasPromotionalKeywords = promotionalKeywords.some((pattern) => pattern.test(fullText))
  const hasRealTransactionKeywords = realTransactionKeywords.some((pattern) => pattern.test(fullText))

  // Se ha parole chiave promozionali MA NON ha parole chiave di transazioni reali, è probabilmente una promozione
  return hasPromotionalKeywords && !hasRealTransactionKeywords
}

export function extractAmountAndCurrency(
  text: string,
): { amount: number; currency: string; sign: '+' | '-' | null } | null {
  // Regex per simboli valuta e codici 3-lettere
  const currencyPattern = '[€$£¥]|USD|EUR|GBP|CHF|AUD|CAD|RON|PLN|CZK|DKK|HUF|SEK|NOK|HRK|BGN|TRY|ILS|HKD|NZD|SGD|ZAR|THB'
  
  // 1. Prova con Segno? + Importo + Spazio? + Valuta (es: "+10,00 €" o "0.29 USD")
  let match = text.match(new RegExp(`([+-])?\\s*([\\d.,]+)\\s*(${currencyPattern})`, 'i'))
  
  // 2. Se non va, prova con Valuta + Spazio? + Importo (es: "$10.00" o "EUR 5,50")
  if (!match) {
    match = text.match(new RegExp(`(${currencyPattern})\\s*([\\d.,]+)`, 'i'))
    if (match) {
      const currency = match[1]
      const amountStr = match[2]
      // In questo caso il segno non è solitamente presente prima della valuta in questo formato, 
      // ma controlliamo se c'è un segno prima della valuta
      const signMatch = text.match(new RegExp(`([+-])\\s*${currency.replace('$', '\\$')}`, 'i'))
      const sign = (signMatch?.[1] as '+' | '-' | undefined) ?? null
      const amount = parseFloat(amountStr.replace(',', '.'))
      return { amount, currency, sign }
    }
    return null
  }

  const sign = (match[1] as ('+' | '-' | undefined)) ?? null
  const amount = parseFloat(match[2].replace(',', '.'))
  const currency = match[3]
  return { amount, currency, sign }
}

export function extractMerchant(title: string): string {
  if (!title) return ''
  if (title.includes(':')) {
    return title.split(':')[0].trim()
  }
  return title
}


