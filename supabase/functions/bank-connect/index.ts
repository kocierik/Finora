import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    )

    const token = authHeader?.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const appId = Deno.env.get('ENABLE_BANKING_APP_ID')
    const privateKeyPem = Deno.env.get('ENABLE_BANKING_PRIVATE_KEY')
    const projectId = Deno.env.get('PROJECT_ID')

    if (!appId || !privateKeyPem || !projectId) {
      throw new Error("Missing configuration in secrets");
    }

    const privateKey = await jose.importPKCS8(privateKeyPem, 'RS256')
    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: appId })
      .setIssuedAt()
      .setIssuer(appId)
      .setAudience('api.enablebanking.com')
      .setExpirationTime('1h')
      .sign(privateKey)

    // Recupero aspsps per validazione
    const aspspsRes = await fetch('https://api.enablebanking.com/aspsps', {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    const aspspsData = await aspspsRes.json();
    
    const body = await req.json().catch(() => ({}));
    let bank_id = body.bank_id || 'Nordea'; 

    // Se non è in lista, forza Nordea che sappiamo esistere
    if (aspspsData.aspsps) {
      const exists = aspspsData.aspsps.some((b: any) => b.name === bank_id);
      if (!exists) bank_id = 'Nordea';
    }

    const redirectUri = `https://${projectId}.supabase.co/functions/v1/bank-callback`
    
    const requestBody = {
      aspsp: {
        name: bank_id,
        country: "FI"
      },
      redirect_url: redirectUri,
      state: user.id,
      access: {
        valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }
    };

    const response = await fetch('https://api.enablebanking.com/auth', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error("❌ Errore API Enable Banking:", data);
      throw new Error(data.message || 'API Error');
    }

    return new Response(JSON.stringify({ url: data.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("💥 Errore finale funzione:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
