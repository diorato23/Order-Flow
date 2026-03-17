/**
 * Cliente para integração com n8n Webhooks.
 */

const N8N_WEBHOOK_URL = "https://n8n.ktuche.com/webhook/comanda"; // Webhook definitivo de produção

export async function triggerN8NWebhook(event: string, data: any) {
  if (!N8N_WEBHOOK_URL) {
    console.warn("[n8n] Gatilho ignorado: N8N_WEBHOOK_URL não configurada.");
    return;
  }

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Aqui poderíamos adicionar uma API Key para produção no futuro
        // "Authorization": `Bearer ${process.env.N8N_API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[n8n] Erro ${response.status}: ${errorText}`);
      throw new Error(`Falha ao disparar evento "${event}" no n8n.`);
    }

    console.log(`[n8n] Evento "${event}" disparado com sucesso.`);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[n8n] Timeout ao disparar evento "${event}".`);
    } else {
      console.error(`[n8n] Erro crítico no evento "${event}":`, error.message);
    }
  }
}
