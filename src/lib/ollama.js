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
      error: describeOllamaError(error, ollamaUrl)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function describeOllamaError(error, ollamaUrl) {
  if (error.name === "AbortError") {
    return "Ollama-Healthcheck hat das Zeitlimit erreicht.";
  }

  const details = [
    error.code,
    error.cause?.code,
    error.cause?.message,
    error.message
  ].filter(Boolean).join(" ");

  if (/ECONNREFUSED|fetch failed|connection refused/i.test(details)) {
    return `Ollama-Dienst nicht erreichbar (${ollamaUrl}).`;
  }

  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(details)) {
    return `Ollama-Host nicht gefunden (${ollamaUrl}).`;
  }

  return error.message || "Ollama-Status konnte nicht ermittelt werden.";
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

module.exports = { checkOllama, ollamaChat, describeOllamaError };
