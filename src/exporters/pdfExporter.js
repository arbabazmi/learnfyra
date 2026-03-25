/**
 * @file src/exporters/pdfExporter.js
 * @description Converts HTML worksheet to PDF using Puppeteer (US Letter size)
 * @agent DEV
 */

import { buildWorksheetHTML, buildAnswerKeyHTML } from '../templates/worksheet.html.js';
import { buildOutputPath } from '../utils/fileUtils.js';

async function launchBrowser() {
  const isLambdaRuntime = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isLambdaRuntime) {
    const [{ default: puppeteerCore }, { default: chromium }] = await Promise.all([
      import('puppeteer-core'),
      import('@sparticuz/chromium'),
    ]);

    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const { default: puppeteer } = await import('puppeteer');
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/**
 * Renders an HTML string to a PDF file via Puppeteer
 * @param {string} html - Complete HTML document string
 * @param {string} outputPath - Destination file path
 * @returns {Promise<string>} Path to the generated PDF file
 */
async function renderToPDF(html, outputPath) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'Letter',        // US Letter: 8.5" × 11"
      printBackground: true,
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
      },
    });
  } finally {
    await browser.close();
  }

  return outputPath;
}

/**
 * Exports the worksheet as a PDF file
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options (outputDir, studentName, etc.)
 * @returns {Promise<string>} Path to the generated PDF file
 */
export async function exportPDF(worksheet, options) {
  const html = buildWorksheetHTML(worksheet, options);
  const outputPath = buildOutputPath(options.outputDir, options, 'pdf');
  return renderToPDF(html, outputPath);
}

/**
 * Exports the answer key as a PDF file
 * @param {Object} worksheet - Parsed worksheet JSON
 * @param {Object} options - Export options
 * @returns {Promise<string>} Path to the generated answer key PDF file
 */
export async function exportAnswerKeyPDF(worksheet, options) {
  const html = buildAnswerKeyHTML(worksheet);
  const outputPath = buildOutputPath(options.outputDir, options, 'pdf', 'ANSWER_KEY');
  return renderToPDF(html, outputPath);
}
