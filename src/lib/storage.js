const fs = require("node:fs");
const path = require("node:path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createStorage(dataDir) {
  const sessionsDir = path.join(dataDir, "sessions");
  ensureDir(sessionsDir);

  function sessionPath(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      const err = new Error("Invalid session id.");
      err.statusCode = 400;
      throw err;
    }
    return path.join(sessionsDir, `${id}.json`);
  }

  function readSession(id) {
    const file = sessionPath(id);
    if (!fs.existsSync(file)) {
      const err = new Error("Session not found.");
      err.statusCode = 404;
      throw err;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  function writeSession(session) {
    const file = sessionPath(session.id);
    const temp = `${file}.${process.pid}.tmp`;
    const now = new Date().toISOString();
    const payload = {
      ...session,
      updatedAt: now
    };
    fs.writeFileSync(temp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(temp, file);
    return payload;
  }

  return { readSession, writeSession };
}

module.exports = { createStorage };
