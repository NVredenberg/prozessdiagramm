const http = require("node:http");
const path = require("node:path");
const { config } = require("./config");
const { sendJson, sendText, sendBuffer, readJsonBody, sendStatic, sendFile } = require("./lib/http");
const { createStorage } = require("./lib/storage");
const { createSession, addUserMessage, analyzeSession, buildStructuredProcess } = require("./lib/processState");
const { validateStructuredProcess } = require("./lib/validator");
const { generateBpmnXmlWithLayout } = require("./lib/bpmnLayout");
const { checkOllama } = require("./lib/ollama");
const { renderExportHtml } = require("./lib/exportHtml");
const { renderSessionPdf } = require("./lib/pdfExport");

const storage = createStorage(config.dataDir);
const vendorAssets = new Map([
  ["/vendor/bpmn-js/bpmn-modeler.production.min.js", ["bpmn-js", "dist", "bpmn-modeler.production.min.js", "text/javascript; charset=utf-8"]],
  ["/vendor/bpmn-js/diagram-js.css", ["bpmn-js", "dist", "assets", "diagram-js.css", "text/css; charset=utf-8"]],
  ["/vendor/bpmn-js/bpmn-js.css", ["bpmn-js", "dist", "assets", "bpmn-js.css", "text/css; charset=utf-8"]],
  ["/vendor/bpmn-js/bpmn-embedded.css", ["bpmn-js", "dist", "assets", "bpmn-font", "css", "bpmn-embedded.css", "text/css; charset=utf-8"]]
]);

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(res, statusCode, {
      error: statusCode === 500 ? "Internal server error" : error.message,
      details: statusCode === 500 ? undefined : error.details
    });
    if (statusCode === 500) {
      console.error(error);
    }
  }
});

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const ollama = await checkOllama({ ollamaUrl: config.ollamaUrl });
    sendJson(res, 200, {
      ok: true,
      service: "ki-prozessmodellierung",
      dataDir: config.dataDir,
      ollama,
      models: {
        chat: config.chatModel,
        extraction: config.extractModel
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/favicon.ico") {
    res.writeHead(204, { "cache-control": "public, max-age=86400" });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      maxQuestions: config.maxQuestions,
      profileOptions: ["swimlane", "bpmn-light"],
      ollamaUrl: config.ollamaUrl,
      chatModel: config.chatModel,
      extractModel: config.extractModel
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sessions") {
    const body = await readJsonBody(req);
    if (!body.sourceText || String(body.sourceText).trim().length < 20) {
      const err = new Error("Bitte beschreibe den Prozess mit mindestens 20 Zeichen.");
      err.statusCode = 400;
      throw err;
    }
    const session = createSession({
      sourceText: body.sourceText,
      profile: body.profile,
      maxQuestions: config.maxQuestions
    });
    await finalizeSessionIfReady(session);
    const state = analyzeSession(session);
    const saved = storage.writeSession(session);
    sendJson(res, 201, toClientSession(saved, state));
    return;
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)(?:\/([^/]+))?$/);
  if (sessionMatch) {
    const [, id, action] = sessionMatch;
    if (req.method === "GET" && !action) {
      const session = storage.readSession(id);
      sendJson(res, 200, toClientSession(session, analyzeSession(session)));
      return;
    }

    if (req.method === "POST" && action === "messages") {
      const body = await readJsonBody(req);
      if (!body.content || String(body.content).trim().length < 2) {
        const err = new Error("Die Antwort darf nicht leer sein.");
        err.statusCode = 400;
        throw err;
      }
      const session = storage.readSession(id);
      const updated = addUserMessage(session, body.content);
      await finalizeSessionIfReady(updated);
      const saved = storage.writeSession(updated);
      sendJson(res, 200, toClientSession(saved, analyzeSession(saved)));
      return;
    }

    if (req.method === "POST" && action === "structure") {
      const session = storage.readSession(id);
      const structured = buildStructuredProcess(session);
      const validation = validateStructuredProcess(structured);
      session.structured = structured;
      session.validation = validation;
      session.bpmnXml = validation.valid ? await generateBpmnXmlWithLayout(structured) : null;
      session.status = validation.valid ? "diagram-ready" : "needs-clarification";
      const saved = storage.writeSession(session);
      sendJson(res, 200, toClientSession(saved, analyzeSession(saved)));
      return;
    }

    if (req.method === "GET" && action === "bpmn") {
      const session = storage.readSession(id);
      if (!session.bpmnXml) {
        const err = new Error("Für diese Session wurde noch kein gültiges BPMN erzeugt.");
        err.statusCode = 404;
        throw err;
      }
      sendText(res, 200, session.bpmnXml, "application/xml; charset=utf-8", {
        "content-disposition": `attachment; filename="prozess-${id}.bpmn"`
      });
      return;
    }

    if (req.method === "GET" && action === "export.html") {
      const session = storage.readSession(id);
      if (!session.structured || !session.validation?.valid) {
        const err = new Error("Die Druckansicht ist erst nach erfolgreicher Validierung verfügbar.");
        err.statusCode = 404;
        throw err;
      }
      sendText(res, 200, renderExportHtml(session), "text/html; charset=utf-8");
      return;
    }

    if (req.method === "GET" && action === "export.pdf") {
      const session = storage.readSession(id);
      if (!session.structured || !session.validation?.valid) {
        const err = new Error("Der PDF-Export ist erst nach erfolgreicher Validierung verfuegbar.");
        err.statusCode = 404;
        throw err;
      }
      const pdf = await renderSessionPdf(session);
      sendBuffer(res, 200, pdf, "application/pdf", {
        "content-disposition": `attachment; filename="prozess-${id}.pdf"`
      });
      return;
    }
  }

  if (req.method === "GET" && sendVendorAsset(url.pathname, res)) {
    return;
  }

  if (req.method === "GET" && sendStatic(req.url, res, config.publicDir)) {
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function toClientSession(session, state) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    profile: session.profile,
    questionCount: session.questionCount,
    maxQuestions: session.maxQuestions,
    messages: session.messages,
    status: session.status,
    completeness: state.completeness,
    missingRequired: state.missingRequired,
    structured: session.structured,
    validation: session.validation,
    hasBpmn: Boolean(session.bpmnXml)
  };
}

async function finalizeSessionIfReady(session) {
  const state = analyzeSession(session);
  if (state.missingRequired.length > 0) return session;

  const structured = buildStructuredProcess(session);
  const validation = validateStructuredProcess(structured);
  session.structured = structured;
  session.validation = validation;
  session.bpmnXml = validation.valid ? await generateBpmnXmlWithLayout(structured) : null;
  session.status = validation.valid ? "diagram-ready" : "needs-clarification";
  return session;
}

function sendVendorAsset(pathname, res) {
  const asset = vendorAssets.get(pathname);
  if (!asset) return false;

  const contentType = asset.at(-1);
  const filePath = path.join(config.rootDir, "node_modules", ...asset.slice(0, -1));
  if (sendFile(res, filePath, contentType)) {
    return true;
  }

  sendJson(res, 404, {
    error: "Vendor asset not found. Bitte fuehre npm install aus."
  });
  return true;
}

if (require.main === module) {
  server.listen(config.port, config.host, () => {
    console.log(`KI-Prozessmodellierung läuft auf http://${config.host}:${config.port}`);
  });
}

module.exports = { server, route, finalizeSessionIfReady };
