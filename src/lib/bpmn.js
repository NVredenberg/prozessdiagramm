function generateBpmnXml(processModel, options = {}) {
  const safeId = sanitizeId(processModel.id || "process");
  const roles = processModel.roles.length > 0 ? processModel.roles : ["Prozess"];
  const nodes = buildNodes(processModel, roles);
  const flows = nodes.slice(0, -1).map((node, index) => ({
    id: `Flow_${index + 1}`,
    source: node.id,
    target: nodes[index + 1].id
  }));

  const laneRefs = new Map(roles.map((role) => [role, []]));
  for (const node of nodes) {
    const lane = node.role && laneRefs.has(node.role) ? node.role : roles[0];
    laneRefs.get(lane).push(node.id);
  }

  const processXml = [
    `  <bpmn:process id="Process_${safeId}" isExecutable="false">`,
    `    <bpmn:laneSet id="LaneSet_${safeId}">`,
    ...roles.flatMap((role, index) => [
      `      <bpmn:lane id="Lane_${index + 1}" name="${escapeXml(role)}">`,
      ...laneRefs.get(role).map((nodeId) => `        <bpmn:flowNodeRef>${nodeId}</bpmn:flowNodeRef>`),
      "      </bpmn:lane>"
    ]),
    "    </bpmn:laneSet>",
    ...nodes.map((node, index) => renderNode(node, flows[index - 1], flows[index])),
    ...flows.map((flow) => `    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.source}" targetRef="${flow.target}" />`),
    "  </bpmn:process>"
  ].join("\n");

  const includeDiagram = options.includeDiagram !== false;
  const diagramXml = includeDiagram ? renderDiagram(safeId, roles, nodes, flows) : null;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_Prozessmodellierung" targetNamespace="https://schule.local/prozessmodellierung">',
    processXml,
    diagramXml,
    "</bpmn:definitions>"
  ].filter(Boolean).join("\n");
}

function buildNodes(processModel, roles) {
  const nodes = [
    {
      id: "StartEvent_1",
      type: "startEvent",
      name: processModel.trigger || "Start",
      role: roles[0]
    }
  ];

  const steps = processModel.steps || [];
  const gatewayIndex = processModel.profile === "bpmn-light" && processModel.decisions?.length > 0
    ? Math.max(1, Math.ceil(steps.length / 2))
    : -1;

  steps.forEach((step, index) => {
    nodes.push({
      id: `Task_${index + 1}`,
      type: "task",
      name: step.text,
      role: roles.includes(step.owner) ? step.owner : roles[0]
    });

    if (index + 1 === gatewayIndex) {
      nodes.push({
        id: "Gateway_1",
        type: "exclusiveGateway",
        name: processModel.decisions[0] || "Entscheidung",
        role: step.owner && roles.includes(step.owner) ? step.owner : roles[0]
      });
    }
  });

  nodes.push({
    id: "EndEvent_1",
    type: "endEvent",
    name: processModel.endStates?.[0] || "Ende",
    role: roles[roles.length - 1]
  });

  return nodes;
}

function renderNode(node, incoming, outgoing) {
  const tag = node.type === "exclusiveGateway" ? "exclusiveGateway" : node.type;
  const lines = [`    <bpmn:${tag} id="${node.id}" name="${escapeXml(node.name)}">`];
  if (incoming) lines.push(`      <bpmn:incoming>${incoming.id}</bpmn:incoming>`);
  if (outgoing) lines.push(`      <bpmn:outgoing>${outgoing.id}</bpmn:outgoing>`);
  lines.push(`    </bpmn:${tag}>`);
  return lines.join("\n");
}

function renderDiagram(safeId, roles, nodes, flows) {
  const laneHeight = 120;
  const width = Math.max(900, nodes.length * 180 + 160);
  const roleIndex = new Map(roles.map((role, index) => [role, index]));
  const positions = new Map();

  nodes.forEach((node, index) => {
    const lane = roleIndex.get(node.role) ?? 0;
    const isEvent = node.type.endsWith("Event");
    const isGateway = node.type === "exclusiveGateway";
    const w = isEvent ? 36 : isGateway ? 50 : 138;
    const h = isEvent ? 36 : isGateway ? 50 : 62;
    positions.set(node.id, {
      x: 120 + index * 180,
      y: 44 + lane * laneHeight + (laneHeight - h) / 2,
      w,
      h
    });
  });

  const shapes = [
    ...roles.map((role, index) =>
      `      <bpmndi:BPMNShape id="Lane_${index + 1}_di" bpmnElement="Lane_${index + 1}" isHorizontal="true"><dc:Bounds x="60" y="${40 + index * laneHeight}" width="${width}" height="${laneHeight}" /></bpmndi:BPMNShape>`
    ),
    ...nodes.map((node) => {
      const pos = positions.get(node.id);
      return `      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}"><dc:Bounds x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" /></bpmndi:BPMNShape>`;
    }),
    ...flows.map((flow) => {
      const source = positions.get(flow.source);
      const target = positions.get(flow.target);
      const x1 = source.x + source.w;
      const y1 = source.y + source.h / 2;
      const x2 = target.x;
      const y2 = target.y + target.h / 2;
      const mid = Math.round((x1 + x2) / 2);
      return [
        `      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">`,
        `        <di:waypoint x="${x1}" y="${y1}" />`,
        `        <di:waypoint x="${mid}" y="${y1}" />`,
        `        <di:waypoint x="${mid}" y="${y2}" />`,
        `        <di:waypoint x="${x2}" y="${y2}" />`,
        "      </bpmndi:BPMNEdge>"
      ].join("\n");
    })
  ];

  return [
    `  <bpmndi:BPMNDiagram id="Diagram_${safeId}">`,
    `    <bpmndi:BPMNPlane id="Plane_${safeId}" bpmnElement="Process_${safeId}">`,
    ...shapes,
    "    </bpmndi:BPMNPlane>",
    "  </bpmndi:BPMNDiagram>"
  ].join("\n");
}

function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { generateBpmnXml, escapeXml };
