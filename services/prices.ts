export async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {}
  // Deduplicate and chunk
  const unique = Array.from(new Set(tickers.filter(Boolean)))
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10))
  const out: Record<string, number> = {}
  for (const chunk of chunks) {
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(','))}`
      const res = await fetch(url)
      const json = await res.json()
      const results = json?.quoteResponse?.result ?? []
      for (const r of results) {
        if (r.symbol && (r.regularMarketPrice != null)) out[r.symbol] = Number(r.regularMarketPrice)
      }
    } catch {
      // ignore chunk errors
    }
  }
  return out
}


