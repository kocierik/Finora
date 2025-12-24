import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    )

    const token = authHeader?.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    // Usiamo il client Admin per le operazioni di scrittura per evitare problemi di RLS complessi con gli upsert
    // mantenendo comunque la sicurezza perché abbiamo verificato l'utente sopra.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Recuperiamo l'ID della categoria "Altro" o "Other" per l'utente
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
    
    const otherCategory = categories?.find(c => 
      c.name.toLowerCase() === 'altro' || 
      c.name.toLowerCase() === 'other' || 
      c.name.toLowerCase() === 'spese varie' ||
      c.name.toLowerCase() === 'varie'
    ) || categories?.[0];

    const { data: accounts, error: accError } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)

    if (accError) throw accError
    
    const validAccounts = (accounts || []).filter(acc => 
      acc.external_account_id && 
      acc.external_account_id !== "[object Object]"
    );

    if (validAccounts.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: "No valid accounts found" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const appId = Deno.env.get('ENABLE_BANKING_APP_ID')
    const privateKeyPem = Deno.env.get('ENABLE_BANKING_PRIVATE_KEY')
    const privateKey = await jose.importPKCS8(privateKeyPem!, 'RS256')

    let totalSynced = 0
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 89);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    for (const acc of validAccounts) {
      const jwt = await new jose.SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: appId })
        .setIssuedAt()
        .setIssuer(appId!)
        .setAudience('api.enablebanking.com')
        .setExpirationTime('1h')
        .sign(privateKey)

      const url = `https://api.enablebanking.com/accounts/${acc.external_account_id}/transactions?date_from=${dateFromStr}`;
      const transRes = await fetch(url, { headers: { 'Authorization': `Bearer ${jwt}` } })
      if (!transRes.ok) continue;

      const data = await transRes.json()
      const transactions = data.transactions || []
      
      for (const t of transactions) {
        const amountValue = parseFloat(t.transaction_amount?.amount || "0")
        const date = t.booking_date || t.value_date || t.transaction_date || new Date().toISOString().split('T')[0]
        const merchant = t.creditor?.name || t.remittance_information?.[0] || 'Bank Transaction'
        const externalId = t.entry_reference || t.transaction_id || `${acc.id}-${date}-${amountValue}`
        const isIncome = t.credit_debit_indicator === 'CRDT'

        if (!isIncome) {
          // 🧠 SISTEMA DI AUTO-CATEGORIZZAZIONE INTELLIGENTE
          let categoryId = null;
          const m = merchant.toLowerCase();

          // 1. Mappatura per Parole Chiave (Keyword mapping)
          const keywords: Record<string, string[]> = {
            'Spesa': [
              'conad', 'coop', 'esselunga', 'carrefour', 'lidl', 'eurospin', 'pam', 'grocery', 'market', 'supermercato', 
              'despar', 'tigros', 'iper', 'bennet', 'penny', 'md', 'crai', 'unes', 'aldi', 'sigma', 'prix', 'selex', 'famila', 'wallmart'
            ],
            'Mangiare / Caffè': [
              'starbucks', 'mcdonald', 'burger king', 'pizza', 'ristorante', 'caffè', 'bar', 'pasticceria', 'sushi', 
              'glovo', 'deliveroo', 'just eat', 'kfc', 'poke', 'aperitivo', 'pub', 'birreria', 'paninoteca', 'trattoria', 
              'gelateria', 'bakery', 'osteria', 'piadineria', 'old wild west', 'roadhouse'
            ],
            'Trasporti': [
              'eni', 'shell', 'tamoil', 'q8', 'uber', 'taxi', 'treno', 'atm', 'trenitalia', 'itineris', 'benzina', 'fuel', 
              'autostrade', 'telepass', 'freenow', 'flixbus', 'lime', 'dott', 'ridemovi', 'tier', 'italo', 'cooltra', 'enjoy', 'sharenow', 'itabus', 'marino', 'avis', 'hertz', 'sixt'
            ],
            'Intrattenimento': [
              'netflix', 'spotify', 'disney+', 'cinema', 'teatro', 'concerto', 'prime video', 'apple.com/bill', 'playstation', 
              'xbox', 'steam', 'dazn', 'nintendo', 'twitch', 'audible', 'kindle', 'ticketone', 'vivaticket', 'skyshowtime'
            ],
            'Cura Personale': [
              'farmacia', 'beauty', 'parrucchiere', 'barber', 'salute', 'palestra', 'gym', 'decathlon', 'clinica', 'ospedale', 
              'dentista', 'sport', 'estetica', 'wellness', 'spa', 'ottica', 'kiko', 'sephora', 'douglas', 'acqua e sapone'
            ],
            'Casa & Bollette': [
              'enel', 'a2a', 'iren', 'edison', 'fastweb', 'vodafone', 'wind3', 'iliad', 'tim', 'tari', 'imu', 'condominio', 
              'affitto', 'rent', 'mutuo', 'ikea', 'leroy merlin', 'sorgenia', 'acea', 'hera', 'e-on', 'servizio elettrico', 
              'sky', 'linkem', 'eolo', 'maisons du monde', 'obi', 'bricoman', 'tecnomat'
            ],
            'Shopping': [
              'amazon', 'ebay', 'zalando', 'h&m', 'zara', 'shein', 'temu', 'aliexpress', 'apple store', 'mediaworld', 
              'unieuro', 'asos', 'nike', 'adidas', 'foot locker', 'bershka', 'pull & bear', 'stradivarius', 'yoox', 
              'bonprix', 'euronics', 'expert', 'trony'
            ],
          };

          for (const [catName, keys] of Object.entries(keywords)) {
            if (keys.some(k => m.includes(k))) {
              const found = categories?.find(c => 
                c.name.toLowerCase() === catName.toLowerCase() ||
                (catName === 'Spesa' && c.name.toLowerCase().includes('grocery')) ||
                (catName === 'Mangiare / Caffè' && c.name.toLowerCase().includes('eating')) ||
                (catName === 'Trasporti' && c.name.toLowerCase().includes('transport')) ||
                (catName === 'Casa & Bollette' && (c.name.toLowerCase().includes('home') || c.name.toLowerCase().includes('utilities'))) ||
                (catName === 'Cura Personale' && c.name.toLowerCase().includes('personal care'))
              );
              if (found) {
                categoryId = found.id;
                break;
              }
            }
          }

          // 2. Se non trovato, cerca l'ultima categoria usata dall'utente per questo merchant (Memoria)
          if (!categoryId) {
            const { data: lastExp } = await supabaseAdmin
              .from('expenses')
              .select('category_id')
              .eq('user_id', user.id)
              .eq('merchant', merchant)
              .not('category_id', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (lastExp?.category_id) {
              categoryId = lastExp.category_id;
            }
          }

          // 3. Fallback finale a "Altro"
          if (!categoryId) {
            categoryId = otherCategory?.id;
          }

          const { error: upsertErr } = await supabaseAdmin.from('expenses').upsert({
            user_id: user.id,
            amount: Math.abs(amountValue),
            merchant,
            currency: t.transaction_amount?.currency || 'EUR',
            date,
            category_id: categoryId, // USIAMO LA CATEGORIA INTELLIGENTE
            external_id: externalId,
            raw_notification: 'Bank Sync'
          }, { onConflict: 'external_id' })
          
          if (!upsertErr) totalSynced++
          else console.error("Error upserting expense:", upsertErr)
        } else {
          // 🧠 AUTO-CATEGORIZZAZIONE ENTRATE
          let incomeCategory = 'other';
          const m = merchant.toLowerCase();

          const incomeKeywords: Record<string, string[]> = {
            'work': ['stipendio', 'salary', 'emolumenti', 'pensione', 'bonus', 'commissioni', 'compensi', 'fringe benefit'],
            'passive': ['airbnb', 'booking', 'affitto', 'rent', 'locazione', 'canone'],
            'investment': ['dividendo', 'cedola', 'coupon', 'binance', 'coinbase', 'directa', 'degiro', 'etoro', 'trading', 'rimborso titoli', 'interessi attivo'],
          };

          for (const [cat, keys] of Object.entries(incomeKeywords)) {
            if (keys.some(k => m.includes(k))) {
              incomeCategory = cat;
              break;
            }
          }

          const { error: upsertErr } = await supabaseAdmin.from('incomes').upsert({
            user_id: user.id,
            amount: amountValue,
            source: merchant,
            currency: t.transaction_amount?.currency || 'EUR',
            date,
            external_id: externalId,
            category: incomeCategory
          }, { onConflict: 'external_id' })
          
          if (!upsertErr) totalSynced++
          else console.error("Error upserting income:", upsertErr)
        }
      }
    }

    return new Response(JSON.stringify({ success: true, synced: totalSynced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, success: false }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
