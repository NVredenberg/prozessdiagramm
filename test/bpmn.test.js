const test = require("node:test");
const assert = require("node:assert/strict");
const { generateBpmnXml } = require("../src/lib/bpmn");
const { generateBpmnXmlWithLayout } = require("../src/lib/bpmnLayout");

test("BPMN XML contains process, lanes, tasks and gateway for BPMN-light", () => {
  const xml = generateBpmnXml({
    id: "abc-123",
    profile: "bpmn-light",
    trigger: "Antrag geht ein",
    roles: ["Sekretariat", "Schulleitung"],
    steps: [
      { text: "Antrag prüfen", owner: "Sekretariat" },
      { text: "Freigabe entscheiden", owner: "Schulleitung" }
    ],
    decisions: ["Antrag vollständig?"],
    endStates: ["Entscheidung dokumentiert"]
  });

  assert.match(xml, /<bpmn:process/);
  assert.match(xml, /<bpmn:lane/);
  assert.match(xml, /<bpmn:task/);
  assert.match(xml, /<bpmn:exclusiveGateway/);
  assert.match(xml, /<bpmndi:BPMNDiagram/);
});

test("BPMN auto layout returns diagram interchange XML or falls back safely", async () => {
  const xml = await generateBpmnXmlWithLayout({
    id: "layout-123",
    profile: "bpmn-light",
    trigger: "Antrag geht ein",
    roles: ["Sekretariat", "Schulleitung"],
    steps: [
      { text: "Antrag erfassen", owner: "Sekretariat" },
      { text: "Unterlagen pruefen", owner: "Sekretariat" },
      { text: "Freigabe entscheiden", owner: "Schulleitung" }
    ],
    decisions: ["Antrag vollstaendig?"],
    endStates: ["Entscheidung dokumentiert"]
  });

  assert.match(xml, /<bpmn:process/);
  assert.match(xml, /<bpmndi:BPMNDiagram/);
});
