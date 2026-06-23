const { generateBpmnXml } = require("./bpmn");

async function generateBpmnXmlWithLayout(processModel) {
  const xmlWithoutDiagram = generateBpmnXml(processModel, { includeDiagram: false });

  try {
    const autoLayout = await import("bpmn-auto-layout");
    return await autoLayout.layoutProcess(xmlWithoutDiagram);
  } catch (error) {
    return generateBpmnXml(processModel);
  }
}

module.exports = { generateBpmnXmlWithLayout };
