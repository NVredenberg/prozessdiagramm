const fs = require("node:fs");
const path = require("node:path");

function boolFromEnv(value, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function intFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const rootDir = path.resolve(__dirname, "..");
loadEnvFile(path.join(rootDir, ".env"));

const config = {
  rootDir,
  publicDir: path.join(rootDir, "public"),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(rootDir, "data")),
  host: process.env.HOST || "0.0.0.0",
  port: intFromEnv(process.env.PORT, 8080),
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  chatModel: process.env.CHAT_MODEL || "gemma4:12b",
  extractModel: process.env.EXTRACT_MODEL || "qwen2.5:14b",
  maxQuestions: intFromEnv(process.env.MAX_QUESTIONS, 10),
  enableOllamaChat: boolFromEnv(process.env.ENABLE_OLLAMA_CHAT, false),
  enableOllamaExtraction: boolFromEnv(process.env.ENABLE_OLLAMA_EXTRACTION, false)
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match || match[1].startsWith("#")) continue;

    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

module.exports = { config, boolFromEnv, intFromEnv, loadEnvFile };
