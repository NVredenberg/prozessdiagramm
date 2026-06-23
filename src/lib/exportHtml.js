const { escapeXml } = require("./bpmn");

function renderExportHtml(session) {
  const model = session.structured;
  const validation = session.validation || { warnings: [] };
  const steps = model.steps || [];
  const roles = model.roles || [];

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Prozessmodell ${escapeHtml(model.purpose)}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1d2528; margin: 0; }
    header { border-bottom: 2px solid #12776b; padding-bottom: 10px; margin-bottom: 14px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    h2 { font-size: 14px; margin: 16px 0 8px; color: #12776b; }
    p, li { font-size: 11px; line-height: 1.45; }
    .grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 18px; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .box { border: 1px solid #cfd8d7; padding: 10px; min-height: 54px; }
    .label { font-size: 9px; text-transform: uppercase; color: #637174; letter-spacing: .04em; }
    ol, ul { padding-left: 18px; margin-top: 6px; }
    .diagram { border: 1px solid #cfd8d7; min-height: 420px; padding: 12px; }
    .lane { border: 1px solid #d7dfde; margin-bottom: 8px; min-height: 74px; display: grid; grid-template-columns: 120px 1fr; }
    .lane-name { background: #eef5f3; padding: 10px; font-weight: 700; font-size: 11px; }
    .lane-flow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px; }
    .node { border: 1px solid #9fb7b2; border-radius: 4px; padding: 7px 9px; max-width: 150px; font-size: 10px; background: #fff; }
    .event { border-radius: 999px; width: 52px; height: 52px; display: grid; place-items: center; text-align: center; }
    .warn { color: #8a5b0a; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(model.purpose)}</h1>
    <p>Profil: ${escapeHtml(model.profile)} · Erstellt: ${escapeHtml(new Date(session.createdAt).toLocaleString("de-DE"))}</p>
  </header>
  <main class="grid">
    <section>
      <div class="meta">
        <div class="box"><div class="label">Start</div><p>${escapeHtml(model.trigger)}</p></div>
        <div class="box"><div class="label">Ende</div><p>${escapeHtml(model.endStates.join("; "))}</p></div>
        <div class="box"><div class="label">Rollen</div><p>${escapeHtml(roles.join(", "))}</p></div>
        <div class="box"><div class="label">Sonderfälle</div><p>${escapeHtml(model.exceptions.join("; ") || "Keine benannt")}</p></div>
      </div>
      <h2>Ablauf</h2>
      <ol>${steps.map((step) => `<li>${escapeHtml(step.text)} <strong>(${escapeHtml(step.owner)})</strong></li>`).join("")}</ol>
      <h2>Entscheidungen</h2>
      <ul>${(model.decisions.length ? model.decisions : ["Keine Entscheidungen benannt"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${validation.warnings?.length ? `<h2>Hinweise</h2><ul>${validation.warnings.map((warning) => `<li class="warn">${escapeHtml(warning.message)}</li>`).join("")}</ul>` : ""}
    </section>
    <section class="diagram">
      ${renderStaticDiagram(model)}
    </section>
  </main>
</body>
</html>`;
}

function renderStaticDiagram(model) {
  const roles = model.roles.length > 0 ? model.roles : ["Prozess"];
  const stepsByRole = new Map(roles.map((role) => [role, []]));
  for (const step of model.steps) {
    const role = roles.includes(step.owner) ? step.owner : roles[0];
    stepsByRole.get(role).push(step);
  }

  return roles.map((role, index) => {
    const nodes = [];
    if (index === 0) nodes.push(`<div class="node event">Start</div>`);
    nodes.push(...stepsByRole.get(role).map((step) => `<div class="node">${escapeHtml(step.text)}</div>`));
    if (index === roles.length - 1) nodes.push(`<div class="node event">Ende</div>`);
    return `<div class="lane"><div class="lane-name">${escapeHtml(role)}</div><div class="lane-flow">${nodes.join("")}</div></div>`;
  }).join("");
}

function escapeHtml(value) {
  return escapeXml(value).replace(/'/g, "&#39;");
}

module.exports = { renderExportHtml, renderStaticDiagram };
