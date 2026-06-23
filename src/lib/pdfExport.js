const { renderExportHtml } = require("./exportHtml");

async function renderSessionPdf(session) {
  const puppeteer = await loadPuppeteer();
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setContent(renderExportHtml(session), { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm"
      }
    });
    return Buffer.from(pdf);
  } catch (error) {
    const err = new Error(`PDF-Export konnte nicht erzeugt werden: ${error.message}`);
    err.statusCode = 503;
    err.cause = error;
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function loadPuppeteer() {
  try {
    const mod = await import("puppeteer");
    return mod.default || mod;
  } catch (error) {
    const err = new Error("PDF-Export ist nicht verfuegbar, weil Puppeteer nicht installiert ist.");
    err.statusCode = 503;
    err.cause = error;
    throw err;
  }
}

module.exports = { renderSessionPdf };
