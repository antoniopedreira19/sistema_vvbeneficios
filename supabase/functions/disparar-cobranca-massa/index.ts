import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_WEBHOOK_URL = "https://grifoworkspace.app.n8n.cloud/webhook/cobrancas-listas";
const TEMPLATE_URL = "https://gkmobhbmgxwrpuucoykn.supabase.co/storage/v1/object/public/MainBucket/modelo_padrao.xlsx";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter user_id do token de autorização
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { competencia, empresas, webhook_url } = await req.json();

    // Usar webhook customizado ou o padrão
    const targetWebhookUrl = webhook_url || DEFAULT_WEBHOOK_URL;

    if (!empresas || empresas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma empresa para notificar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payload com todos os emails de contato
    const payload = {
      competencia,
      template_url: TEMPLATE_URL,
      empresas: empresas.map((emp: { nome: string; emails: string[] }) => ({
        nome: emp.nome,
        emails: emp.emails,
      })),
    };

    console.log("Enviando para n8n:", targetWebhookUrl, JSON.stringify(payload));

    const response = await fetch(targetWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro n8n:", errorText);
      throw new Error(`Erro n8n: ${response.status}`);
    }

    const result = await response.text();
    console.log("Resposta n8n:", result);

    // Salvar no histórico
    const { error: histError } = await supabase
      .from("historico_cobrancas")
      .insert({
        competencia,
        total_empresas: empresas.length,
        empresas_notificadas: empresas,
        disparado_por: userId,
      });

    if (histError) {
      console.error("Erro ao salvar histórico:", histError);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Cobrança enviada para ${empresas.length} empresas` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});