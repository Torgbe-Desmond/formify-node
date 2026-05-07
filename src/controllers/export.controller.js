const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

// ─── Validators ──────────────────────────────────────────────────────────────

const exportPdfRules = [
  body('html').notEmpty().withMessage('html is required').isString(),
  body('filename').optional().isString().trim(),
  body('margins').optional().isInt({ min: 0, max: 200 }),
  validate,
];

// ─── Handler ─────────────────────────────────────────────────────────────────

async function exportPdf(req, res, next) {
  let browser;
  try {
    // Lazy-require so the app still starts even if puppeteer isn't installed yet
    const puppeteer = require('puppeteer');

    const { html, filename = 'document', margins = 60 } = req.body;

    const marginPx = `${margins}px`;

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // important for Docker / low-memory envs
      ],
    });

    const page = await browser.newPage();

    // Set A4 viewport so relative units (vw, %) behave as expected
    await page.setViewport({ width: 794, height: 1123 });

    // setContent renders the full HTML including any <style> tags already
    // injected by the frontend (templateCss is embedded as <style>...</style>)
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,     // renders background colours and images
      margin: {
        top: marginPx,
        bottom: marginPx,
        left: marginPx,
        right: marginPx,
      },
    });

    await browser.close();
    browser = null;

    // Sanitise filename — strip path separators and dangerous characters
    const safeName = String(filename)
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim() || 'document';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    // Make sure the browser is closed even if something goes wrong
    if (browser) {
      await browser.close().catch(() => {});
    }
    next(err);
  }
}

module.exports = {
  exportPdf,
  exportPdfRules,
};
