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

    // Recuperiamo l'ID della categoria "Altro" o "Other" per l'utente
    const { data: categories } = await supabaseClient
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
    
    const otherCategory = categories?.find(c => 
      c.name.toLowerCase() === 'altro' || 
      c.name.toLowerCase() === 'other' || 
      c.name.toLowerCase() === 'spese varie'
    ) || categories?.[0];

    const { data: accounts, error: accError } = await supabaseClient
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
          const { error: upsertErr } = await supabaseClient.from('expenses').upsert({
            user_id: user.id,
            amount: Math.abs(amountValue),
            merchant,
            currency: t.transaction_amount?.currency || 'EUR',
            date,
            category_id: otherCategory?.id, // ASSEGNIAMO LA CATEGORIA
            external_id: externalId,
            raw_notification: 'Bank Sync'
          }, { onConflict: 'external_id' })
          
          if (!upsertErr) totalSynced++
          else console.error("Error upserting expense:", upsertErr)
        } else {
          const { error: upsertErr } = await supabaseClient.from('incomes').upsert({
            user_id: user.id,
            amount: amountValue,
            source: merchant,
            currency: t.transaction_amount?.currency || 'EUR',
            date,
            external_id: externalId,
            category: 'work' // Default per incomes
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
