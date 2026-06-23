const state = {
  session: null,
  health: null,
  bpmnModeler: null,
  bpmnImportKey: null,
  bpmnImportToken: 0,
  bpmnDirty: false
};

const elements = {
  startForm: document.querySelector("#startForm"),
  sourceText: document.querySelector("#sourceText"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatButton: document.querySelector("#chatForm button"),
  chatLog: document.querySelector("#chatLog"),
  blockList: document.querySelector("#blockList"),
  validateBtn: document.querySelector("#validateBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  printBtn: document.querySelector("#printBtn"),
  pdfBtn: document.querySelector("#pdfBtn"),
  systemState: document.querySelector("#systemState"),
  sessionLine: document.querySelector("#sessionLine"),
  validationSummary: document.querySelector("#validationSummary"),
  statusPill: document.querySelector("#statusPill"),
  issues: document.querySelector("#issues"),
  diagramCanvas: document.querySelector("#diagramCanvas"),
  diagramMode: document.querySelector("#diagramMode")
};

elements.startForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sourceText = elements.sourceText.value.trim();
  const profile = document.querySelector("input[name='profile']:checked").value;
  if (!sourceText) return;

  setBusy(elements.startForm.querySelector("button"), true);
  try {
    const session = await api("/api/sessions", {
      method: "POST",
      body: { sourceText, profile }
    });
    state.session = session;
    render();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(elements.startForm.querySelector("button"), false);
  }
});

elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = elements.chatInput.value.trim();
  if (!state.session || !content) return;

  setBusy(elements.chatButton, true);
  try {
    const session = await api(`/api/sessions/${state.session.id}/messages`, {
      method: "POST",
      body: { content }
    });
    state.session = session;
    elements.chatInput.value = "";
    render();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(elements.chatButton, false);
  }
});

elements.validateBtn.addEventListener("click", async () => {
  if (!state.session) return;
  setBusy(elements.validateBtn, true);
  try {
    const session = await api(`/api/sessions/${state.session.id}/structure`, {
      method: "POST"
    });
    state.session = session;
    render();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(elements.validateBtn, false);
  }
});

elements.downloadBtn.addEventListener("click", async () => {
  if (!state.session?.hasBpmn) return;
  await downloadCurrentBpmn();
});

elements.printBtn.addEventListener("click", () => {
  if (!state.session?.validation?.valid) return;
  window.open(`/api/sessions/${state.session.id}/export.html`, "_blank", "noopener");
});

elements.pdfBtn.addEventListener("click", () => {
  if (!state.session?.validation?.valid) return;
  window.location.href = `/api/sessions/${state.session.id}/export.pdf`;
});

async function boot() {
  renderBlocks([]);
  try {
    state.health = await api("/health");
  } catch (error) {
    state.health = { ok: false, ollama: { ok: false, error: error.message } };
  }
  renderSystem();
}

function render() {
  renderSessionLine();
  renderBlocks(state.session?.completeness || []);
  renderMessages();
  renderValidation();
  renderDiagram();
  renderActions();
}

function renderSessionLine() {
  if (!state.session) {
    elements.sessionLine.textContent = "Neue Session";
    return;
  }
  elements.sessionLine.textContent = `Session ${state.session.id.slice(0, 8)} · ${state.session.profile}`;
}

function renderBlocks(blocks) {
  const defaultBlocks = [
    ["start", "Start"],
    ["flow", "Ablauf"],
    ["decisions", "Entscheidungen"],
    ["responsibilities", "Verantwortlichkeiten"],
    ["exceptions", "Sonderfälle"],
    ["end", "Ende"]
  ].map(([id, label]) => ({ id, label, filled: false }));

  const list = blocks.length ? blocks : defaultBlocks;
  elements.blockList.innerHTML = list.map((block) => `
    <div class="block-item ${block.filled ? "done" : ""}">
      <div class="dot"></div>
      <div>
        <strong>${escapeHtml(block.label)}</strong>
        <span>${block.filled ? "gefüllt" : "offen"}</span>
      </div>
    </div>
  `).join("");
}

function renderMessages() {
  const messages = state.session?.messages || [];
  elements.chatLog.innerHTML = messages.map((message) => `
    <div class="message ${message.role}">
      ${escapeHtml(message.content)}
    </div>
  `).join("");
  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function renderValidation() {
  const validation = state.session?.validation;
  if (!validation) {
    elements.validationSummary.textContent = "Noch keine Struktur geprüft.";
    setPill("neutral", "Bereit");
    elements.issues.innerHTML = "";
    return;
  }

  if (validation.valid) {
    elements.validationSummary.textContent = "Die Struktur ist diagrammfähig.";
    setPill(validation.warnings.length ? "warn" : "ok", validation.warnings.length ? "Mit Hinweisen" : "Gültig");
  } else {
    elements.validationSummary.textContent = "Vor der Diagrammerstellung fehlen noch Pflichtangaben.";
    setPill("error", "Offen");
  }

  const issues = [
    ...validation.errors.map((item) => ({ ...item, type: "error" })),
    ...validation.warnings.map((item) => ({ ...item, type: "warning" }))
  ];
  elements.issues.innerHTML = issues.map((item) => `
    <div class="issue ${item.type}">${escapeHtml(item.message)}</div>
  `).join("");
}

async function renderDiagram() {
  const model = state.session?.structured;
  if (!model || !state.session.validation?.valid) {
    destroyBpmnModeler();
    elements.diagramMode.textContent = "Noch kein BPMN";
    elements.diagramCanvas.classList.remove("bpmn-active");
    elements.diagramCanvas.innerHTML = `
      <div class="empty-state">
        <strong>Wartet auf validierte Struktur</strong>
        <span>Start, Ablauf, Verantwortlichkeiten und Ende müssen gefüllt sein.</span>
      </div>
    `;
    return;
  }

  if (!window.BpmnJS) {
    destroyBpmnModeler();
    elements.diagramMode.textContent = "BPMN-Fallback";
    elements.diagramCanvas.classList.remove("bpmn-active");
    elements.diagramCanvas.innerHTML = renderPreviewWithNotice(model, "bpmn-js ist noch nicht geladen. Die einfache Vorschau bleibt aktiv.");
    return;
  }

  const importKey = `${state.session.id}:${state.session.updatedAt}`;
  if (state.bpmnImportKey === importKey && state.bpmnModeler) {
    elements.diagramMode.textContent = state.bpmnDirty ? "BPMN bearbeitet" : "BPMN editierbar";
    return;
  }

  const token = ++state.bpmnImportToken;
  elements.diagramMode.textContent = "BPMN lädt";
  elements.diagramCanvas.classList.add("bpmn-active");
  elements.diagramCanvas.innerHTML = '<div class="bpmn-modeler" aria-label="BPMN-Editor"></div>';

  try {
    const xml = await fetchBpmnXml(state.session.id);
    if (token !== state.bpmnImportToken) return;

    const container = elements.diagramCanvas.querySelector(".bpmn-modeler");
    const modeler = createBpmnModeler(container);
    await modeler.importXML(xml);
    modeler.get("canvas").zoom("fit-viewport", "auto");
    state.bpmnModeler = modeler;
    state.bpmnImportKey = importKey;
    state.bpmnDirty = false;
    elements.diagramMode.textContent = "BPMN editierbar";
  } catch (error) {
    if (token !== state.bpmnImportToken) return;
    destroyBpmnModeler();
    elements.diagramMode.textContent = "BPMN-Fallback";
    elements.diagramCanvas.classList.remove("bpmn-active");
    elements.diagramCanvas.innerHTML = renderPreviewWithNotice(model, `BPMN-Editor konnte nicht geladen werden: ${error.message}`);
  }
}

function createBpmnModeler(container) {
  destroyBpmnModeler();
  const modeler = new window.BpmnJS({ container });

  modeler.on("commandStack.changed", () => {
    state.bpmnDirty = true;
    elements.diagramMode.textContent = "BPMN bearbeitet";
  });

  return modeler;
}

function destroyBpmnModeler() {
  if (state.bpmnModeler) {
    state.bpmnModeler.destroy();
  }
  state.bpmnModeler = null;
  state.bpmnImportKey = null;
  state.bpmnDirty = false;
}

async function fetchBpmnXml(sessionId) {
  const response = await fetch(`/api/sessions/${sessionId}/bpmn`, {
    headers: { accept: "application/xml" }
  });
  const xml = await response.text();
  if (!response.ok) {
    throw new Error(xml || `HTTP ${response.status}`);
  }
  return xml;
}

async function downloadCurrentBpmn() {
  if (!state.bpmnModeler) {
    window.location.href = `/api/sessions/${state.session.id}/bpmn`;
    return;
  }

  try {
    const { xml } = await state.bpmnModeler.saveXML({ format: true });
    downloadBlob(xml, `prozess-${state.session.id}.bpmn`, "application/bpmn20-xml;charset=utf-8");
  } catch (error) {
    showToast(`BPMN-XML konnte nicht exportiert werden: ${error.message}`);
  }
}

function downloadBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderPreviewWithNotice(model, message) {
  return `<div class="diagram-notice">${escapeHtml(message)}</div>${renderPreview(model)}`;
}

function renderPreview(model) {
  const roles = model.roles.length ? model.roles : ["Prozess"];
  const stepsByRole = new Map(roles.map((role) => [role, []]));
  for (const step of model.steps) {
    const role = roles.includes(step.owner) ? step.owner : roles[0];
    stepsByRole.get(role).push(step);
  }

  return roles.map((role, roleIndex) => {
    const nodes = [];
    if (roleIndex === 0) nodes.push(node("Start", "event"));
    for (const step of stepsByRole.get(role)) {
      nodes.push(node(step.text));
    }
    if (model.profile === "bpmn-light" && roleIndex === 0 && model.decisions.length) {
      nodes.push(node(compactGatewayLabel(model.decisions[0]), "gateway"));
    }
    if (roleIndex === roles.length - 1) nodes.push(node("Ende", "event"));

    return `
      <div class="preview-lane">
        <div class="lane-name">${escapeHtml(role)}</div>
        <div class="lane-flow">${withArrows(nodes).join("")}</div>
      </div>
    `;
  }).join("");
}

function node(text, variant = "") {
  if (variant === "gateway") {
    return `<div class="node gateway"><span>${escapeHtml(text)}</span></div>`;
  }
  return `<div class="node ${variant}">${escapeHtml(text)}</div>`;
}

function compactGatewayLabel(text) {
  const value = String(text || "");
  if (/freigabe|genehmigt|ablehnt|lehnt ab/i.test(value)) return "Freigabe?";
  if (/vollständig|vollstaendig|unterlagen/i.test(value)) return "Vollständig?";
  if (/prüf|pruef|entscheid/i.test(value)) return "Prüfung?";
  return value.length > 28 ? "Entscheidung?" : value;
}

function withArrows(nodes) {
  return nodes.flatMap((item, index) => index < nodes.length - 1 ? [item, '<span class="arrow">→</span>'] : [item]);
}

function renderActions() {
  const hasSession = Boolean(state.session);
  const hasBpmn = Boolean(state.session?.hasBpmn);
  elements.chatInput.disabled = !hasSession;
  elements.chatButton.disabled = !hasSession;
  elements.validateBtn.disabled = !hasSession;
  elements.downloadBtn.disabled = !hasBpmn;
  elements.printBtn.disabled = !hasBpmn;
  elements.pdfBtn.disabled = !hasBpmn;
}

function renderSystem() {
  const ollama = state.health?.ollama;
  if (!ollama) {
    elements.systemState.textContent = "Status nicht verfügbar";
    return;
  }
  elements.systemState.textContent = ollama.ok
    ? `Ollama erreichbar · ${ollama.latencyMs} ms`
    : `Ollama nicht erreichbar · ${ollama.error}`;
}

function setPill(type, label) {
  elements.statusPill.className = `status-pill ${type}`;
  elements.statusPill.textContent = label;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.dataset.originalText ||= button.textContent;
  button.textContent = busy ? "Bitte warten" : button.dataset.originalText;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(payload.error || payload || `HTTP ${response.status}`);
  }
  return payload;
}

function showToast(message) {
  elements.validationSummary.textContent = message;
  setPill("error", "Fehler");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

boot();
