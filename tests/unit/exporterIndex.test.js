/**
 * @file tests/unit/exporterIndex.test.js
 * @description Unit tests for the worksheet export orchestrator (exportWorksheet).
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleWorksheet = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/sampleWorksheet.json'), 'utf-8')
);

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/exporters/htmlExporter.js', () => ({
  exportHTML:          jest.fn().mockResolvedValue('/tmp/worksheet.html'),
  exportAnswerKeyHTML: jest.fn().mockResolvedValue('/tmp/answer.html'),
  getWorksheetHTML:    jest.fn().mockReturnValue('<html>worksheet</html>'),
  getAnswerKeyHTML:    jest.fn().mockReturnValue('<html>key</html>'),
}));

jest.unstable_mockModule('../../src/exporters/pdfExporter.js', () => ({
  exportPDF:          jest.fn().mockResolvedValue('/tmp/worksheet.pdf'),
  exportAnswerKeyPDF: jest.fn().mockResolvedValue('/tmp/answer.pdf'),
}));

jest.unstable_mockModule('../../src/exporters/docxExporter.js', () => ({
  exportDOCX:          jest.fn().mockResolvedValue('/tmp/worksheet.docx'),
  exportAnswerKeyDOCX: jest.fn().mockResolvedValue('/tmp/answer.docx'),
}));

jest.unstable_mockModule('../../src/exporters/answerKey.js', () => ({
  exportAnswerKey: jest.fn().mockResolvedValue(['/tmp/ak.html']),
}));

// Dynamic imports after all mockModule calls
const { exportWorksheet } = await import('../../src/exporters/index.js');
const { exportHTML }      = await import('../../src/exporters/htmlExporter.js');
const { exportPDF }       = await import('../../src/exporters/pdfExporter.js');
const { exportDOCX }      = await import('../../src/exporters/docxExporter.js');
const { exportAnswerKey } = await import('../../src/exporters/answerKey.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportWorksheet()', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Format routing ────────────────────────────────────────────────────────

  it('format HTML → calls exportHTML and returns the path', async () => {
    const paths = await exportWorksheet(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(exportHTML).toHaveBeenCalledTimes(1);
    expect(exportHTML).toHaveBeenCalledWith(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(paths).toContain('/tmp/worksheet.html');
  });

  it('format HTML → does NOT call PDF or DOCX exporters', async () => {
    await exportWorksheet(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(exportPDF).not.toHaveBeenCalled();
    expect(exportDOCX).not.toHaveBeenCalled();
  });

  it('format PDF → calls exportPDF and returns the path', async () => {
    const paths = await exportWorksheet(sampleWorksheet, { format: 'PDF', outputDir: '/tmp' });
    expect(exportPDF).toHaveBeenCalledTimes(1);
    expect(paths).toContain('/tmp/worksheet.pdf');
  });

  it('format PDF → does NOT call HTML or DOCX exporters', async () => {
    await exportWorksheet(sampleWorksheet, { format: 'PDF', outputDir: '/tmp' });
    expect(exportHTML).not.toHaveBeenCalled();
    expect(exportDOCX).not.toHaveBeenCalled();
  });

  it('format "Word (.docx)" → calls exportDOCX and returns the path', async () => {
    const paths = await exportWorksheet(sampleWorksheet, { format: 'Word (.docx)', outputDir: '/tmp' });
    expect(exportDOCX).toHaveBeenCalledTimes(1);
    expect(paths).toContain('/tmp/worksheet.docx');
  });

  it('format "Word (.docx)" → does NOT call HTML or PDF exporters', async () => {
    await exportWorksheet(sampleWorksheet, { format: 'Word (.docx)', outputDir: '/tmp' });
    expect(exportHTML).not.toHaveBeenCalled();
    expect(exportPDF).not.toHaveBeenCalled();
  });

  it('format "All Three" → calls all three worksheet exporters', async () => {
    await exportWorksheet(sampleWorksheet, { format: 'All Three', outputDir: '/tmp' });
    expect(exportHTML).toHaveBeenCalledTimes(1);
    expect(exportPDF).toHaveBeenCalledTimes(1);
    expect(exportDOCX).toHaveBeenCalledTimes(1);
  });

  it('format "All Three" → returned paths include all three worksheet files', async () => {
    const paths = await exportWorksheet(sampleWorksheet, { format: 'All Three', outputDir: '/tmp' });
    expect(paths).toContain('/tmp/worksheet.html');
    expect(paths).toContain('/tmp/worksheet.pdf');
    expect(paths).toContain('/tmp/worksheet.docx');
  });

  it('unknown format → returns empty array and calls no exporters', async () => {
    const paths = await exportWorksheet(sampleWorksheet, { format: 'Unknown', outputDir: '/tmp' });
    expect(paths).toEqual([]);
    expect(exportHTML).not.toHaveBeenCalled();
    expect(exportPDF).not.toHaveBeenCalled();
    expect(exportDOCX).not.toHaveBeenCalled();
  });

  // ── Answer key inclusion ──────────────────────────────────────────────────

  it('includeAnswerKey: true → calls exportAnswerKey', async () => {
    await exportWorksheet(sampleWorksheet, {
      format: 'HTML',
      outputDir: '/tmp',
      includeAnswerKey: true,
    });
    expect(exportAnswerKey).toHaveBeenCalledTimes(1);
  });

  it('includeAnswerKey: true → answer key paths are included in the result', async () => {
    const paths = await exportWorksheet(sampleWorksheet, {
      format: 'HTML',
      outputDir: '/tmp',
      includeAnswerKey: true,
    });
    expect(paths).toContain('/tmp/worksheet.html');
    expect(paths).toContain('/tmp/ak.html');
  });

  it('includeAnswerKey: false → does NOT call exportAnswerKey', async () => {
    await exportWorksheet(sampleWorksheet, {
      format: 'HTML',
      outputDir: '/tmp',
      includeAnswerKey: false,
    });
    expect(exportAnswerKey).not.toHaveBeenCalled();
  });

  it('includeAnswerKey: undefined → does NOT call exportAnswerKey', async () => {
    await exportWorksheet(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(exportAnswerKey).not.toHaveBeenCalled();
  });

  it('format "All Three" with includeAnswerKey → returns worksheet paths plus answer key paths', async () => {
    const paths = await exportWorksheet(sampleWorksheet, {
      format: 'All Three',
      outputDir: '/tmp',
      includeAnswerKey: true,
    });
    expect(paths.length).toBe(4); // 3 worksheet + 1 answer key mock
    expect(paths).toContain('/tmp/ak.html');
  });

});
