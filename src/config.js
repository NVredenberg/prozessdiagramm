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

const config = {
  rootDir,
  publicDir: path.join(rootDir, "public"),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(rootDir, "data")),
  host: process.env.HOST || "0.0.0.0",
  port: intFromEnv(process.env.PORT, 8080),
  ollamaUrl: process.env.OLLAMA_URL || "http://ollama:11434",
  chatModel: process.env.CHAT_MODEL || "gemma4:12b",
  extractModel: process.env.EXTRACT_MODEL || "qwen2.5:14b",
  maxQuestions: intFromEnv(process.env.MAX_QUESTIONS, 10),
  enableOllamaChat: boolFromEnv(process.env.ENABLE_OLLAMA_CHAT, false),
  enableOllamaExtraction: boolFromEnv(process.env.ENABLE_OLLAMA_EXTRACTION, false)
};

module.exports = { config, boolFromEnv, intFromEnv };
