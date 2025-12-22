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
  // Prima prova con segno esplicito, poi senza
  let match = text.match(/([+-])?\s*([\d.,]+)\s*([€$£])/i)
  if (!match) {
    match = text.match(/([\d.,]+)\s*([€$£])/i)
    if (!match) return null
    const amount = parseFloat(match[1].replace(',', '.'))
    const currency = match[2]
    return { amount, currency, sign: null }
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


