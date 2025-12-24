import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') 
  const error = url.searchParams.get('error')

  if (error || !code) {
    return Response.redirect(`com.kocierik.finora://bank-callback?error=${error || 'missing_code'}`, 302)
  }

  try {
    const appId = Deno.env.get('ENABLE_BANKING_APP_ID')
    const privateKeyPem = Deno.env.get('ENABLE_BANKING_PRIVATE_KEY')
    const privateKey = await jose.importPKCS8(privateKeyPem!, 'RS256')

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: appId })
      .setIssuedAt()
      .setIssuer(appId!)
      .setAudience('api.enablebanking.com')
      .setExpirationTime('1h')
      .sign(privateKey)

    const sessionRes = await fetch('https://api.enablebanking.com/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code })
    })

    const sessionData = await sessionRes.json()
    if (!sessionRes.ok) throw new Error(sessionData.message || 'Failed to exchange session')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: conn, error: connErr } = await supabaseAdmin
      .from('bank_connections')
      .insert({
        user_id: state,
        bank_name: sessionData.aspsp?.name || 'Bank Account',
        bank_id: sessionData.aspsp?.name || 'unknown', 
        external_session_id: sessionData.session_id,
        status: 'active',
        access_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (connErr) throw connErr

    const accounts = sessionData.accounts || []
    for (const acc of accounts) {
      // USIAMO 'uid' che abbiamo visto nei log, è quello che serve per le transazioni
      const accountId = acc.uid || acc.resource_id;
      
      if (accountId) {
        await supabaseAdmin.from('bank_accounts').insert({
          connection_id: conn.id,
          user_id: state,
          external_account_id: accountId,
          iban: acc.account_id?.iban || acc.iban,
          name: acc.product || acc.name || 'Conto Corrente'
        })
      }
    }

    return Response.redirect(`com.kocierik.finora://bank-callback?status=success&session_id=${sessionData.session_id}`, 302)

  } catch (err) {
    console.error('Callback error:', err)
    return Response.redirect(`com.kocierik.finora://bank-callback?status=error&message=${encodeURIComponent(err.message)}`, 302)
  }
})
