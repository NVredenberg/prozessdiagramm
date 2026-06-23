const fs = require("node:fs");
const path = require("node:path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
    ...headers
  });
  res.end(body);
}

function sendBuffer(res, statusCode, body, contentType = "application/octet-stream", headers = {}) {
  res.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": body.length,
    "cache-control": "no-store",
    ...headers
  });
  res.end(body);
}

async function readJsonBody(req, limitBytes = 1_000_000) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      const err = new Error("Request body is too large.");
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error("Request body must be valid JSON.");
    err.statusCode = 400;
    err.cause = error;
    throw err;
  }
}

function sendStatic(reqUrl, res, publicDir) {
  const url = new URL(reqUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(publicDir, relativePath);
  const publicRoot = path.resolve(publicDir);

  if (!filePath.startsWith(publicRoot)) {
    sendText(res, 403, "Forbidden");
    return true;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  res.writeHead(200, {
    "content-type": contentType,
    "cache-control": "no-cache"
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function sendFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-type": contentType || MIME_TYPES[extension] || "application/octet-stream",
    "cache-control": "public, max-age=86400"
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

module.exports = { sendJson, sendText, sendBuffer, readJsonBody, sendStatic, sendFile };
