const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createSession,
  addUserMessage,
  buildStructuredProcess,
  analyzeSession,
  extractRoles,
  hasResponsibilitySignal
} = require("../src/lib/processState");

test("session tracks required process blocks", () => {
  const session = createSession({
    profile: "bpmn-light",
    maxQuestions: 10,
    sourceText: "Der Prozess beginnt, wenn ein Antrag eingeht. Danach prüft das Sekretariat die Unterlagen."
  });

  let state = analyzeSession(session);
  assert.ok(state.missingRequired.includes("end"));
  assert.equal(session.questionCount, 1);

  addUserMessage(session, "Die Schulleitung genehmigt oder lehnt ab. Der Prozess endet mit der dokumentierten Entscheidung. Verantwortlich sind Sekretariat und Schulleitung.");
  state = analyzeSession(session);
  assert.equal(state.missingRequired.includes("end"), false);
  assert.equal(state.missingRequired.includes("responsibilities"), false);
});

test("structured process assigns detected roles", () => {
  const session = createSession({
    profile: "swimlane",
    maxQuestions: 10,
    sourceText: "Der Prozess beginnt mit einer Meldung. Zuerst prüft das Sekretariat die Meldung. Danach informiert die Schulleitung das Kollegium. Der Prozess endet mit einer dokumentierten Freigabe. Verantwortlich: Sekretariat, Schulleitung."
  });

  const model = buildStructuredProcess(session);
  assert.ok(model.roles.includes("Sekretariat"));
  assert.ok(model.roles.includes("Schulleitung"));
  assert.equal(model.roles.includes("SchulleITung"), false);
  assert.equal(model.roles.includes("IT"), false);
  assert.equal(model.decisions.some((decision) => decision.includes("beginnt")), false);
  assert.ok(model.steps.length >= 2);
  assert.equal(model.endStates.length > 0, true);
});

test("responsibility answers with names and tasks are accepted", () => {
  const session = createSession({
    profile: "swimlane",
    maxQuestions: 10,
    sourceText: "Der Prozess beginnt mit einem Antrag. Zuerst wird der Antrag erfasst. Danach wird die Freigabe vorbereitet. Der Prozess endet mit der dokumentierten Entscheidung."
  });

  addUserMessage(session, "Herr Mueller: prueft den Antrag; Frau Schmidt: genehmigt die Freigabe.");

  const state = analyzeSession(session);
  assert.equal(state.missingRequired.includes("responsibilities"), false);
  assert.equal(hasResponsibilitySignal("Herr Mueller: prueft den Antrag"), true);
  assert.deepEqual(extractRoles("", ["Herr Mueller: prueft den Antrag", "Frau Schmidt: genehmigt die Freigabe"]), [
    "Herr Mueller",
    "Frau Schmidt"
  ]);
});
