import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type Aspsp = {
  name?: string
  country?: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    const token = authHeader?.replace("Bearer ", "")

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const appId = Deno.env.get("ENABLE_BANKING_APP_ID")
    const privateKeyPem = Deno.env.get("ENABLE_BANKING_PRIVATE_KEY")
    if (!appId || !privateKeyPem) throw new Error("Missing configuration in secrets")

    const body = await req.json().catch(() => ({}))
    const country = String(body?.country || "IT").toUpperCase()

    const privateKey = await jose.importPKCS8(privateKeyPem, "RS256")
    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: appId })
      .setIssuedAt()
      .setIssuer(appId)
      .setAudience("api.enablebanking.com")
      .setExpirationTime("1h")
      .sign(privateKey)

    const aspspsRes = await fetch("https://api.enablebanking.com/aspsps", {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    const aspspsData = await aspspsRes.json()
    if (!aspspsRes.ok) {
      throw new Error(aspspsData?.message || "Failed to fetch banks")
    }

    const list: Aspsp[] = Array.isArray(aspspsData?.aspsps) ? aspspsData.aspsps : []
    const filtered = list
      .filter((b) => (b?.country || "").toUpperCase() === country)
      .map((b) => ({ name: b.name, country: b.country }))
      .filter((b) => !!b.name)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))

    return new Response(JSON.stringify({ aspsps: filtered, country }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})


