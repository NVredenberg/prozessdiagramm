async function checkOllama({ ollamaUrl, timeoutMs = 1200 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(new URL("/api/tags", ollamaUrl), {
      signal: controller.signal
    });
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        error: `Ollama antwortet mit HTTP ${response.status}.`
      };
    }
    const payload = await response.json();
    return {
      ok: true,
      latencyMs,
      models: Array.isArray(payload.models) ? payload.models.map((model) => model.name) : []
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error.name === "AbortError" ? "Ollama-Healthcheck hat das Zeitlimit erreicht." : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function ollamaChat({ ollamaUrl, model, messages, format, timeoutMs = 45_000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL("/api/chat", ollamaUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed with HTTP ${response.status}.`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { checkOllama, ollamaChat };
