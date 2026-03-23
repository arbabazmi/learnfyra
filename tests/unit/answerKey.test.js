/**
 * @file tests/unit/answerKey.test.js
 * @description Unit tests for the answer key orchestrator (exportAnswerKey).
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
  exportAnswerKeyHTML: jest.fn().mockResolvedValue('/tmp/answer.html'),
  exportHTML:          jest.fn().mockResolvedValue('/tmp/worksheet.html'),
  getWorksheetHTML:    jest.fn().mockReturnValue('<html>worksheet</html>'),
  getAnswerKeyHTML:    jest.fn().mockReturnValue('<html>key</html>'),
}));

jest.unstable_mockModule('../../src/exporters/pdfExporter.js', () => ({
  exportAnswerKeyPDF: jest.fn().mockResolvedValue('/tmp/answer.pdf'),
  exportPDF:          jest.fn().mockResolvedValue('/tmp/worksheet.pdf'),
}));

jest.unstable_mockModule('../../src/exporters/docxExporter.js', () => ({
  exportAnswerKeyDOCX: jest.fn().mockResolvedValue('/tmp/answer.docx'),
  exportDOCX:          jest.fn().mockResolvedValue('/tmp/worksheet.docx'),
}));

// Dynamic imports after all mockModule calls
const { exportAnswerKey } = await import('../../src/exporters/answerKey.js');
const { exportAnswerKeyHTML } = await import('../../src/exporters/htmlExporter.js');
const { exportAnswerKeyPDF }  = await import('../../src/exporters/pdfExporter.js');
const { exportAnswerKeyDOCX } = await import('../../src/exporters/docxExporter.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportAnswerKey()', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('format HTML → calls exportAnswerKeyHTML and returns one path', async () => {
    const paths = await exportAnswerKey(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(exportAnswerKeyHTML).toHaveBeenCalledTimes(1);
    expect(exportAnswerKeyHTML).toHaveBeenCalledWith(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(paths).toEqual(['/tmp/answer.html']);
  });

  it('format HTML → does NOT call PDF or DOCX exporters', async () => {
    await exportAnswerKey(sampleWorksheet, { format: 'HTML', outputDir: '/tmp' });
    expect(exportAnswerKeyPDF).not.toHaveBeenCalled();
    expect(exportAnswerKeyDOCX).not.toHaveBeenCalled();
  });

  it('format PDF → calls exportAnswerKeyPDF and returns one path', async () => {
    const paths = await exportAnswerKey(sampleWorksheet, { format: 'PDF', outputDir: '/tmp' });
    expect(exportAnswerKeyPDF).toHaveBeenCalledTimes(1);
    expect(paths).toEqual(['/tmp/answer.pdf']);
  });

  it('format PDF → does NOT call HTML or DOCX exporters', async () => {
    await exportAnswerKey(sampleWorksheet, { format: 'PDF', outputDir: '/tmp' });
    expect(exportAnswerKeyHTML).not.toHaveBeenCalled();
    expect(exportAnswerKeyDOCX).not.toHaveBeenCalled();
  });

  it('format "Word (.docx)" → calls exportAnswerKeyDOCX and returns one path', async () => {
    const paths = await exportAnswerKey(sampleWorksheet, { format: 'Word (.docx)', outputDir: '/tmp' });
    expect(exportAnswerKeyDOCX).toHaveBeenCalledTimes(1);
    expect(paths).toEqual(['/tmp/answer.docx']);
  });

  it('format "Word (.docx)" → does NOT call HTML or PDF exporters', async () => {
    await exportAnswerKey(sampleWorksheet, { format: 'Word (.docx)', outputDir: '/tmp' });
    expect(exportAnswerKeyHTML).not.toHaveBeenCalled();
    expect(exportAnswerKeyPDF).not.toHaveBeenCalled();
  });

  it('format "All Three" → calls all three exporters', async () => {
    await exportAnswerKey(sampleWorksheet, { format: 'All Three', outputDir: '/tmp' });
    expect(exportAnswerKeyHTML).toHaveBeenCalledTimes(1);
    expect(exportAnswerKeyPDF).toHaveBeenCalledTimes(1);
    expect(exportAnswerKeyDOCX).toHaveBeenCalledTimes(1);
  });

  it('format "All Three" → returns 3 paths', async () => {
    const paths = await exportAnswerKey(sampleWorksheet, { format: 'All Three', outputDir: '/tmp' });
    expect(paths).toHaveLength(3);
    expect(paths).toContain('/tmp/answer.html');
    expect(paths).toContain('/tmp/answer.pdf');
    expect(paths).toContain('/tmp/answer.docx');
  });

  it('unknown format → returns empty array without calling any exporter', async () => {
    const paths = await exportAnswerKey(sampleWorksheet, { format: 'Unknown', outputDir: '/tmp' });
    expect(paths).toEqual([]);
    expect(exportAnswerKeyHTML).not.toHaveBeenCalled();
    expect(exportAnswerKeyPDF).not.toHaveBeenCalled();
    expect(exportAnswerKeyDOCX).not.toHaveBeenCalled();
  });

  it('undefined format → returns empty array', async () => {
    const paths = await exportAnswerKey(sampleWorksheet, { outputDir: '/tmp' });
    expect(paths).toEqual([]);
  });

});
