const test = require("node:test");
const assert = require("node:assert/strict");
const { validateStructuredProcess } = require("../src/lib/validator");

test("validator blocks incomplete process models", () => {
  const result = validateStructuredProcess({
    profile: "swimlane",
    trigger: "",
    roles: [],
    steps: [{ text: "Prüfen", owner: "Unklar" }],
    decisions: [],
    exceptions: [],
    endStates: []
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "missing_start"));
  assert.ok(result.errors.some((error) => error.code === "missing_responsibilities"));
});

test("validator accepts minimal complete process model", () => {
  const result = validateStructuredProcess({
    profile: "bpmn-light",
    trigger: "Antrag geht ein",
    roles: ["Sekretariat"],
    steps: [
      { text: "Antrag prüfen", owner: "Sekretariat" },
      { text: "Entscheidung dokumentieren", owner: "Sekretariat" }
    ],
    decisions: ["Antrag vollständig?"],
    exceptions: [],
    endStates: ["Entscheidung dokumentiert"]
  });

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((warning) => warning.code === "no_exceptions"));
});
