// ==============================================================================
// SUPABASE EDGE FUNCTION: webhook-payment
// Despliegue serverless nativo en Supabase (Deno runtime)
// Comando de despliegue: supabase functions deploy webhook-payment --no-verify-jwt
// ==============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const webhookSecretKey = Deno.env.get("WEBHOOK_SECRET_KEY") ?? "";

    const authHeader = req.headers.get("x-webhook-secret") || req.headers.get("authorization");
    const body = await req.json().catch(() => ({}));

    if (
      authHeader !== webhookSecretKey &&
      authHeader !== `Bearer ${webhookSecretKey}` &&
      body.secret !== webhookSecretKey
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "No autorizado: Secret inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      source,
      payer_name,
      amount,
      operation_number,
      concept,
      recipient_email,
      raw_payload
    } = body;

    if (!payer_name || amount === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: "Datos insuficientes (payer_name y amount requeridos)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedAmount = Math.round(Number(amount) * 100) / 100;
    const paymentSource = (source || "OTRO").toUpperCase();

    // Idempotencia
    if (operation_number) {
      const { data: existing } = await supabase
        .from("payment_logs")
        .select("id")
        .eq("operation_number", operation_number)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: "Operación ya procesada previamente." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Localizar perfil de acreedor
    let targetUserId = null;
    if (recipient_email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", recipient_email.trim())
        .maybeSingle();
      if (profile) targetUserId = profile.id;
    }

    if (!targetUserId) {
      const { data: fallbackUser } = await supabase.from("profiles").select("id").limit(1).single();
      if (fallbackUser) targetUserId = fallbackUser.id;
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "No se encontró ningún usuario configurado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar deudas activas
    const { data: activeDebts } = await supabase
      .from("debts")
      .select("*")
      .eq("user_id", targetUserId)
      .in("status", ["PENDIENTE", "PAGO_PARCIAL"]);

    let matchedDebt = null;
    let matchType = "UNMATCHED";

    const clean = (t: string) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // Buscar por concepto o nombre
    if (activeDebts && activeDebts.length > 0) {
      if (concept) {
        matchedDebt = activeDebts.find((d) => d.payment_slug && clean(concept).includes(clean(d.payment_slug)));
        if (matchedDebt) matchType = "REFERENCE_CODE";
      }

      if (!matchedDebt) {
        const normPayer = clean(payer_name);
        matchedDebt = activeDebts.find((d) => {
          const normDebtor = clean(d.debtor_name);
          return normPayer.includes(normDebtor) || normDebtor.includes(normPayer);
        });
        if (matchedDebt) matchType = "FUZZY_NAME";
      }
    }

    if (matchedDebt) {
      const currentRemaining = Number(matchedDebt.remaining_amount);
      const isFull = parsedAmount >= currentRemaining;
      const newStatus = isFull ? "PAGADO" : "PAGO_PARCIAL";
      const newRemaining = Math.max(0, Math.round((currentRemaining - parsedAmount) * 100) / 100);

      await supabase
        .from("debts")
        .update({
          remaining_amount: newRemaining,
          status: newStatus,
          paid_at: isFull ? new Date().toISOString() : matchedDebt.paid_at,
          updated_at: new Date().toISOString()
        })
        .eq("id", matchedDebt.id);

      const { data: log } = await supabase
        .from("payment_logs")
        .insert({
          user_id: targetUserId,
          debt_id: matchedDebt.id,
          payer_name: payer_name.trim(),
          amount: parsedAmount,
          currency: matchedDebt.currency || "PEN",
          payment_method: paymentSource,
          operation_number: operation_number || null,
          raw_concept: concept || null,
          raw_payload: raw_payload || body,
          matched_by: matchType,
          status: "CONCILIADO"
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, reconciled: true, debt_id: matchedDebt.id, new_status: newStatus, log }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const { data: log } = await supabase
        .from("payment_logs")
        .insert({
          user_id: targetUserId,
          debt_id: null,
          payer_name: payer_name.trim(),
          amount: parsedAmount,
          currency: "PEN",
          payment_method: paymentSource,
          operation_number: operation_number || null,
          raw_concept: concept || null,
          raw_payload: raw_payload || body,
          matched_by: "UNMATCHED",
          status: "NO_CONCILIADO"
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, reconciled: false, message: "Guardado como NO_CONCILIADO", log }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
