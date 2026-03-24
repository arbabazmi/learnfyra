/**
 * @file server.js
 * @description Local development server. Serves the frontend as static files
 * and exposes /api/* routes backed by the real generators — no AWS/S3 needed.
 *
 * Usage:
 *   node server.js
 *   open http://localhost:3000
 *
 * Required env var:
 *   ANTHROPIC_API_KEY   your Anthropic API key (copy .env.example → .env)
 */

import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const LOCAL_FILES_DIR = join(__dirname, 'worksheets-local');

// ── Validate required env vars ────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\nERROR: ANTHROPIC_API_KEY is not set.');
  console.error('Copy .env.example to .env and add your Anthropic API key.\n');
  process.exit(1);
}

mkdirSync(LOCAL_FILES_DIR, { recursive: true });

// ── Lazy-load the core modules ─────────────────────────────────────────────────
const { generateWorksheet } = await import('./src/ai/generator.js');
const { exportWorksheet }   = await import('./src/exporters/index.js');
const { exportAnswerKey }   = await import('./src/exporters/answerKey.js');
const { validateGenerateBody } = await import('./backend/middleware/validator.js');

const FORMAT_EXT = {
  'PDF':        'pdf',
  'Word (.docx)': 'docx',
  'HTML':       'html',
};

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Serve the frontend
app.use(express.static(join(__dirname, 'frontend')));

// Serve locally generated worksheet files for download
app.use('/local-files', express.static(LOCAL_FILES_DIR));

// ── POST /api/generate ────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    // Validate input
    let validated;
    try {
      validated = validateGenerateBody(req.body);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const {
      grade, subject, topic, difficulty, questionCount, format, includeAnswerKey,
      studentName, worksheetDate, teacherName, period, className,
    } = validated;
    const ext = FORMAT_EXT[format];
    const uuid = randomUUID();
    const outputDir = LOCAL_FILES_DIR;

    // Shared export options (including optional student details)
    const exportOpts = {
      grade, subject, topic, difficulty, format,
      studentName, worksheetDate, teacherName, period, className,
      outputDir,
    };

    // Generate worksheet JSON via Claude API
    const worksheet = await generateWorksheet({ grade, subject, topic, difficulty, questionCount });

    // Export worksheet file to worksheets-local/
    const worksheetPaths = await exportWorksheet(worksheet, {
      ...exportOpts,
      includeAnswerKey: false,
    });
    const worksheetFilename = worksheetPaths[0].split(/[\\/]/).pop();
    const worksheetKey = `local/${worksheetFilename}`;

    // Export answer key if requested
    let answerKeyKey = null;
    if (includeAnswerKey) {
      const answerKeyPaths = await exportAnswerKey(worksheet, exportOpts);
      if (answerKeyPaths.length > 0) {
        const answerKeyFilename = answerKeyPaths[0].split(/[\\/]/).pop();
        answerKeyKey = `local/${answerKeyFilename}`;
      }
    }

    res.json({
      success: true,
      worksheetKey,
      answerKeyKey,
      metadata: {
        id: uuid,
        generatedAt: new Date().toISOString(),
        grade, subject, topic, difficulty, questionCount, format,
      },
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/download?key=local/<filename> ────────────────────────────────────
app.get('/api/download', (req, res) => {
  const key = req.query.key;
  if (!key || !key.startsWith('local/')) {
    return res.status(400).json({ error: 'Invalid or missing key parameter.' });
  }
  // Return a direct local URL — app.js will open this to trigger the download
  const downloadUrl = `http://localhost:${PORT}/local-files/${key.replace('local/', '')}`;
  res.json({ downloadUrl });
});

// Fallback for SPA
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nEduSheet AI — local dev server`);
  console.log(`  App:   http://localhost:${PORT}`);
  console.log(`  Files: ${LOCAL_FILES_DIR}`);
  console.log('\nReady. Open the URL above in your browser.\n');
});
