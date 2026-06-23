const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "prozessmodellierung-"));
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";

const { server } = require("../src/server");
const { config } = require("../src/config");

test("API creates, validates and exports a process session", async (t) => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await getJson(`${baseUrl}/health`);
  assert.equal(health.ok, true);
  assert.equal(config.ollamaUrl, "http://localhost:11434");
  assert.equal(JSON.stringify(health.ollama).includes("http://ollama:11434"), false);

  const favicon = await fetch(`${baseUrl}/favicon.ico`);
  assert.equal(favicon.status, 204);

  const created = await postJson(`${baseUrl}/api/sessions`, {
    profile: "bpmn-light",
    sourceText: "Der Prozess beginnt, wenn ein Antrag im Sekretariat eingeht. Zuerst prüft das Sekretariat die Unterlagen. Danach leitet das Sekretariat den Antrag an die Schulleitung weiter. Die Schulleitung prüft die Freigabe und genehmigt oder lehnt ab. Bei fehlenden Unterlagen fordert das Sekretariat eine Rückfrage an. Der Prozess endet mit einer dokumentierten Entscheidung. Verantwortlich: Sekretariat, Schulleitung."
  });
  assert.equal(created.profile, "bpmn-light");
  assert.equal(created.hasBpmn, true);
  assert.equal(created.validation.valid, true);
  assert.match(created.messages.at(-1).content, /automatisch das Prozessmodell/);

  const structured = await postJson(`${baseUrl}/api/sessions/${created.id}/structure`, {});
  assert.equal(structured.validation.valid, true);
  assert.equal(structured.hasBpmn, true);

  const bpmn = await fetch(`${baseUrl}/api/sessions/${created.id}/bpmn`);
  assert.equal(bpmn.ok, true);
  assert.match(await bpmn.text(), /<bpmn:definitions/);

  const printable = await fetch(`${baseUrl}/api/sessions/${created.id}/export.html`);
  assert.equal(printable.ok, true);
  assert.match(await printable.text(), /Prozessmodell/);

  const pdf = await fetch(`${baseUrl}/api/sessions/${created.id}/export.pdf`);
  assert.ok([200, 503].includes(pdf.status));
  if (pdf.status === 200) {
    assert.match(pdf.headers.get("content-type"), /application\/pdf/);
    assert.ok((await pdf.arrayBuffer()).byteLength > 1000);
  } else {
    assert.match(await pdf.text(), /PDF-Export/);
  }
});

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.ok, true);
  return response.json();
}
