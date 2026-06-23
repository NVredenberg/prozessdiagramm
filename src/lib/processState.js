const crypto = require("node:crypto");

const REQUIRED_BLOCKS = [
  {
    id: "start",
    label: "Start",
    question: "Wodurch beginnt der Prozess genau? Bitte nenne den Auslöser oder Eingang."
  },
  {
    id: "flow",
    label: "Ablauf",
    question: "Welche Schritte passieren danach in der richtigen Reihenfolge?"
  },
  {
    id: "decisions",
    label: "Entscheidungen",
    question: "Gibt es Entscheidungen, Verzweigungen oder Prüfungen im Ablauf?"
  },
  {
    id: "responsibilities",
    label: "Verantwortlichkeiten",
    question: "Welche Rollen oder Personen sind für die einzelnen Schritte verantwortlich?"
  },
  {
    id: "exceptions",
    label: "Sonderfälle",
    question: "Welche Sonderfälle, fehlenden Unterlagen oder Eskalationen können auftreten?"
  },
  {
    id: "end",
    label: "Ende",
    question: "Wann ist der Prozess abgeschlossen und welches Ergebnis liegt dann vor?"
  }
];

const RESPONSIBILITY_HINTS = [
  "lehrkraft",
  "sekretariat",
  "schulleitung",
  "verwaltung",
  "teamleitung",
  "ausbilder",
  "lernende",
  "schüler",
  "schueler",
  "kollegium",
  "fachbereich",
  "admin",
  "it"
];

const RESPONSIBILITY_ACTIONS = [
  "bearbeitet",
  "dokumentiert",
  "entscheidet",
  "erstellt",
  "fordert",
  "genehmigt",
  "informiert",
  "klaert",
  "klÃ¤rt",
  "kontrolliert",
  "leitet",
  "meldet",
  "prueft",
  "prÃ¼ft",
  "sendet",
  "speichert",
  "uebernimmt",
  "Ã¼bernimmt"
];

const EXTRA_RESPONSIBILITY_HINTS = [
  "abteilung",
  "antragsteller",
  "antragstellerin",
  "ausbilderin",
  "bereich",
  "dienstleister",
  "kunde",
  "kundin",
  "koordination",
  "leitung",
  "mitarbeiter",
  "mitarbeiterin",
  "sachbearbeitung",
  "team"
];

const IGNORED_ROLE_LABELS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "ein",
  "eine",
  "prozess",
  "start",
  "ende",
  "danach",
  "zuerst",
  "anschliessend",
  "anschlieÃŸend",
  "falls",
  "wenn"
]);

function createSession({ sourceText, profile, maxQuestions }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session = {
    id,
    createdAt: now,
    updatedAt: now,
    profile: normalizeProfile(profile),
    sourceText: cleanText(sourceText),
    questionCount: 0,
    maxQuestions,
    messages: [],
    status: "collecting",
    structured: null,
    validation: null,
    bpmnXml: null
  };

  const state = analyzeSession(session);
  session.messages.push({
    role: "assistant",
    content: buildAssistantReply(state, session),
    createdAt: now
  });
  session.questionCount = state.nextQuestion ? 1 : 0;
  session.status = state.missingRequired.length === 0 ? "ready-for-validation" : "collecting";
  return session;
}

function addUserMessage(session, content) {
  const now = new Date().toISOString();
  session.messages.push({
    role: "user",
    content: cleanText(content),
    createdAt: now
  });

  const state = analyzeSession(session);
  const canAsk = session.questionCount < session.maxQuestions;
  const assistantContent = buildAssistantReply(state, session, canAsk);
  if (state.nextQuestion && canAsk) {
    session.questionCount += 1;
  }

  session.messages.push({
    role: "assistant",
    content: assistantContent,
    createdAt: now
  });
  session.status = state.missingRequired.length === 0 ? "ready-for-validation" : "collecting";
  return session;
}

function analyzeSession(session) {
  const combinedText = collectUserText(session);
  const signals = extractSignals(combinedText, session.profile);
  const completeness = REQUIRED_BLOCKS.map((block) => ({
    ...block,
    filled: isBlockFilled(block.id, signals),
    value: signals[block.id]
  }));
  const missing = completeness.filter((block) => !block.filled);
  const nextQuestion = missing[0]?.question || null;
  return {
    combinedText,
    signals,
    completeness,
    missingRequired: missing.map((block) => block.id),
    nextQuestion
  };
}

function buildStructuredProcess(session) {
  const state = analyzeSession(session);
  const roles = extractRoles(state.combinedText, state.signals.responsibilities);
  const steps = normalizeSteps(state.signals.flow).map((text, index) => ({
    id: `step-${index + 1}`,
    text,
    owner: findOwnerForStep(text, roles) || roles[0] || "Unklar"
  }));

  return {
    id: session.id,
    profile: session.profile,
    purpose: summarizePurpose(state.combinedText),
    trigger: firstValue(state.signals.start),
    roles,
    steps,
    decisions: normalizeSteps(state.signals.decisions),
    exceptions: normalizeSteps(state.signals.exceptions),
    endStates: normalizeSteps(state.signals.end),
    sourceText: state.combinedText,
    completeness: state.completeness
  };
}

function buildAssistantReply(state, session, canAsk = true) {
  if (state.missingRequired.length === 0) {
    return "Die Pflichtbausteine sind ausreichend gefüllt. Ich kann die Struktur jetzt prüfen und daraus ein BPMN-Modell vorbereiten.";
  }

  if (!canAsk) {
    const missingLabels = state.completeness
      .filter((block) => !block.filled)
      .map((block) => block.label)
      .join(", ");
    return `Die Rückfragen-Grenze ist erreicht. Offen bleiben: ${missingLabels}. Bitte ergänze diese Punkte vor der Diagrammerstellung.`;
  }

  const asked = session.questionCount + 1;
  return `${state.nextQuestion} (${asked}/${session.maxQuestions})`;
}

function collectUserText(session) {
  const messageText = session.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
  return cleanText(`${session.sourceText}\n${messageText}`);
}

function extractSignals(text, profile = "swimlane") {
  const sentences = splitSentences(text);
  const lower = text.toLowerCase();
  const startPattern = /(beginnt|start|auslöser|ausloeser|sobald|wenn .* eingeht|eingang|antrag|meldung|bedarf)/i;
  const endPattern = /(endet|ende|abschluss|abgeschlossen|freigegeben|genehmigt|abgelehnt|archiviert|dokumentiert|fertig)/i;
  const decisionPattern = /(falls|oder|prüf|pruef|entscheid|genehmig|ablehn|ja\/nein|freigabe|gateway)/i;

  const start = sentences.filter((sentence) => startPattern.test(sentence));
  const end = sentences.filter((sentence) => endPattern.test(sentence));
  const decisions = sentences.filter((sentence) =>
    decisionPattern.test(sentence) && !startPattern.test(sentence) && !endPattern.test(sentence)
  );
  const exceptions = sentences.filter((sentence) =>
    /(sonderfall|ausnahme|fehlt|unvollständig|unvollstaendig|eskal|problem|nachreichen|rückfrage|rueckfrage)/i.test(sentence)
  );
  const responsibilities = sentences.filter(hasResponsibilitySignal);

  const flow = sentences.filter((sentence) =>
    /(danach|anschließend|anschliessend|zuerst|prüft|prueft|erstellt|sendet|informiert|speichert|legt|bearbeitet|dokumentiert|leitet|freigibt|freigabe|nimmt|gibt|meldet)/i.test(sentence)
  );

  if (flow.length === 0 && sentences.length > 0) {
    flow.push(...sentences.slice(0, 8));
  }

  if (profile === "swimlane" && decisions.length === 0 && lower.includes("genehmigung")) {
    decisions.push("Genehmigung prüfen");
  }

  return {
    start,
    flow,
    decisions,
    responsibilities,
    exceptions,
    end
  };
}

function isBlockFilled(id, signals) {
  if (id === "flow") return normalizeSteps(signals.flow).length >= 2;
  if (id === "responsibilities") return extractRoles("", signals.responsibilities).length > 0;
  if (id === "decisions" || id === "exceptions") return true;
  return normalizeSteps(signals[id]).length > 0;
}

function splitSentences(text) {
  return cleanText(text)
    .split(/\n+|(?<=[.!?])\s+|;\s+|(?:\s+-\s+)/u)
    .map((sentence) => sentence.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

function normalizeSteps(value) {
  const items = Array.isArray(value) ? value : splitSentences(String(value || ""));
  return items
    .map((item) => cleanText(item).replace(/^[0-9]+[.)]\s*/, ""))
    .filter(Boolean)
    .slice(0, 16);
}

function extractRoles(text, responsibilitySentences = []) {
  const source = `${text}\n${normalizeSteps(responsibilitySentences).join("\n")}`;
  const found = new Set();
  const addRole = (value) => {
    const cleaned = cleanRole(value);
    if (cleaned && isLikelyRole(cleaned)) {
      found.add(cleaned);
    }
  };

  for (const hint of [...RESPONSIBILITY_HINTS, ...EXTRA_RESPONSIBILITY_HINTS]) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(hint)}($|[^\\p{L}\\p{N}])`, "iu");
    if (pattern.test(source)) {
      addRole(capitalizeRole(hint));
    }
  }

  const explicitMatches = source.matchAll(/(?:rolle|rollen|verantwortlich|zuständig|zustaendig|aufgabe|aufgaben)\s*[:=]\s*([^\n.]+)/gi);
  for (const match of explicitMatches) {
    for (const role of match[1].split(/,|\/| und /i)) {
      addRole(role);
    }
  }

  const colonMatches = source.matchAll(/(?:^|[.;\n]\s*)([^:.;\n]{2,45})\s*:\s*[^.;\n]+/gu);
  for (const match of colonMatches) {
    for (const role of match[1].split(/,|\/| und /i)) {
      addRole(role);
    }
  }

  const actionPattern = RESPONSIBILITY_ACTIONS.map(escapeRegExp).join("|");
  const actorActionPattern = new RegExp(
    `(?:^|[.;\\n]\\s*)(?:der|die|das|den|dem|eine|ein)?\\s*([\\p{Lu}][\\p{L}.-]*(?:\\s+[\\p{Lu}][\\p{L}.-]*){0,2})\\s+(?:${actionPattern})\\b`,
    "gu"
  );
  for (const match of source.matchAll(actorActionPattern)) {
    addRole(match[1]);
  }

  return Array.from(found).slice(0, 8);
}

function findOwnerForStep(step, roles) {
  const lower = step.toLowerCase();
  return roles.find((role) => lower.includes(role.toLowerCase()));
}

function summarizePurpose(text) {
  const first = splitSentences(text)[0] || "Prozessmodell";
  return first.length > 180 ? `${first.slice(0, 177)}...` : first;
}

function firstValue(value) {
  return normalizeSteps(value)[0] || "";
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanRole(value) {
  const cleaned = cleanText(value)
    .replace(/^(die|der|das|den|dem|eine|ein)\s+/i, "")
    .replace(new RegExp(`\\s+(?:${RESPONSIBILITY_ACTIONS.map(escapeRegExp).join("|")})\\b.*$`, "i"), "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[.,:;]+$/g, "");
  if (!cleaned || cleaned.length > 40) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function hasResponsibilitySignal(sentence) {
  const text = cleanText(sentence);
  if (!text) return false;

  if (/(verantwort|zuständig|zustaendig|rolle|rollen|aufgabe|aufgaben|durch|von der|vom)/i.test(text)) {
    return true;
  }

  if (/^[^:]{2,45}:\s*\S/u.test(text)) {
    return true;
  }

  const hints = [...RESPONSIBILITY_HINTS, ...EXTRA_RESPONSIBILITY_HINTS];
  if (hints.some((hint) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(hint)}($|[^\\p{L}\\p{N}])`, "iu").test(text))) {
    return true;
  }

  const actionPattern = RESPONSIBILITY_ACTIONS.map(escapeRegExp).join("|");
  return new RegExp(
    `(?:^|[.;\\n]\\s*)(?:der|die|das|den|dem|eine|ein)?\\s*[\\p{Lu}][\\p{L}.-]*(?:\\s+[\\p{Lu}][\\p{L}.-]*){0,2}\\s+(?:${actionPattern})\\b`,
    "u"
  ).test(text);
}

function isLikelyRole(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized || IGNORED_ROLE_LABELS.has(normalized)) return false;
  if (/^(und|oder|sowie)\b/i.test(normalized)) return false;
  return true;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function capitalizeRole(value) {
  if (value === "it") return "IT";
  const normalized = value === "schueler" ? "Schüler" : value;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeProfile(profile) {
  return profile === "bpmn-light" ? "bpmn-light" : "swimlane";
}

module.exports = {
  REQUIRED_BLOCKS,
  createSession,
  addUserMessage,
  analyzeSession,
  buildStructuredProcess,
  extractSignals,
  extractRoles,
  normalizeSteps,
  hasResponsibilitySignal
};
