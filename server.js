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
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const LOCAL_FILES_DIR = join(__dirname, 'worksheets-local');

// ── Validate required env vars ────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('\nWARNING: ANTHROPIC_API_KEY is not set.');
  console.warn('Copy .env.example to .env and add your Anthropic API key.');
  console.warn('Auth, student, class, and analytics routes will still work.\n');
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

const DIAGNOSTIC_HEADERS = 'x-request-id,x-client-request-id';

function setDiagnosticHeaders(res, requestId, clientRequestId) {
  res.set('Access-Control-Expose-Headers', DIAGNOSTIC_HEADERS);
  res.set('x-request-id', requestId);
  if (clientRequestId) {
    res.set('x-client-request-id', clientRequestId);
  }
}

function logGenerateEvent(level, message, details) {
  console[level](JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...details,
  }));
}

function serializeError(err) {
  const error = err instanceof Error ? err : new Error(String(err));

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Serve the frontend
app.use(express.static(join(__dirname, 'frontend')));

// Serve locally generated worksheet files for download
app.use('/local-files', express.static(LOCAL_FILES_DIR));

// ── POST /api/generate ────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const requestId = randomUUID();
  const clientRequestId = req.get('x-client-request-id') || null;
  const requestStart = Date.now();
  let stage = 'request:start';

  setDiagnosticHeaders(res, requestId, clientRequestId);

  try {
    logGenerateEvent('info', 'server generate request started', {
      requestId,
      clientRequestId,
      stage,
      method: req.method,
      path: req.originalUrl,
    });

    // Validate input
    let validated;
    try {
      stage = 'request:validate-body';
      validated = validateGenerateBody(req.body);
    } catch (err) {
      logGenerateEvent('warn', 'server generate request validation failed', {
        requestId,
        clientRequestId,
        stage,
        error: serializeError(err),
      });
      return res.status(400).json({
        success: false,
        error: err.message,
        errorCode: 'VALIDATION_ERROR',
        errorStage: stage,
        requestId,
        clientRequestId,
      });
    }

    const {
      grade, subject, topic, difficulty, questionCount, format, includeAnswerKey,
      studentName, worksheetDate, teacherName, period, className,
    } = validated;
    const ext = FORMAT_EXT[format];
    const uuid = randomUUID();
    const outputDir = join(LOCAL_FILES_DIR, uuid);
    mkdirSync(outputDir, { recursive: true });

    logGenerateEvent('info', 'server generate request validated', {
      requestId,
      clientRequestId,
      stage,
      grade,
      subject,
      topic,
      difficulty,
      questionCount,
      format,
      includeAnswerKey,
    });

    // Shared export options (including optional student details)
    const exportOpts = {
      grade, subject, topic, difficulty, format,
      studentName, worksheetDate, teacherName, period, className,
      outputDir,
    };

    // Generate worksheet JSON via Claude API
    stage = 'worksheet:generate';
    const worksheet = await generateWorksheet({ grade, subject, topic, difficulty, questionCount });
    logGenerateEvent('info', 'server worksheet generated', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      totalPoints: worksheet.totalPoints,
      questionCount: Array.isArray(worksheet.questions) ? worksheet.questions.length : null,
    });

    // Export worksheet file to worksheets-local/
    stage = 'worksheet:export';
    const worksheetPaths = await exportWorksheet(worksheet, {
      ...exportOpts,
      includeAnswerKey: false,
    });
    const worksheetFilename = worksheetPaths[0].split(/[\\/]/).pop();
    const worksheetKey = `local/${uuid}/${worksheetFilename}`;
    logGenerateEvent('info', 'server worksheet exported', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      worksheetKey,
      worksheetPath: worksheetPaths[0],
    });

    // Save solve-data.json for the online solve feature
    stage = 'worksheet:write-solve-data';
    const solveData = {
      worksheetId: uuid,
      generatedAt: new Date().toISOString(),
      grade,
      subject,
      topic,
      difficulty,
      estimatedTime: worksheet.estimatedTime || '20 minutes',
      timerSeconds: typeof worksheet.estimatedTime === 'string'
        ? (parseInt(worksheet.estimatedTime, 10) || 20) * 60
        : 1200,
      totalPoints: worksheet.totalPoints,
      questions: worksheet.questions,
    };
    writeFileSync(join(outputDir, 'solve-data.json'), JSON.stringify(solveData, null, 2));
    logGenerateEvent('info', 'server solve data written', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      solveDataPath: join(outputDir, 'solve-data.json'),
    });

    // Export answer key if requested
    let answerKeyKey = null;
    if (includeAnswerKey) {
      stage = 'answer-key:export';
      const answerKeyPaths = await exportAnswerKey(worksheet, exportOpts);
      if (answerKeyPaths.length > 0) {
        const answerKeyFilename = answerKeyPaths[0].split(/[\\/]/).pop();
        answerKeyKey = `local/${uuid}/${answerKeyFilename}`;
        logGenerateEvent('info', 'server answer key exported', {
          requestId,
          clientRequestId,
          stage,
          elapsedMs: Date.now() - requestStart,
          answerKeyKey,
          answerKeyPath: answerKeyPaths[0],
        });
      }
    }

    const now = new Date();
    stage = 'response:success';
    res.json({
      success: true,
      worksheetKey,
      answerKeyKey,
      requestId,
      clientRequestId,
      metadata: {
        id: uuid,
        solveUrl: `/solve.html?id=${uuid}`,
        generatedAt: now.toISOString(),
        grade,
        subject,
        topic,
        difficulty,
        questionCount,
        format,
        studentDetails: {
          studentName,
          worksheetDate,
          teacherName,
          period,
          className,
        },
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (err) {
    logGenerateEvent('error', 'server generate request failed', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      error: serializeError(err),
    });
    res.status(500).json({
      success: false,
      error: 'Worksheet generation failed. Please try again.',
      errorCode: 'GENERATION_FAILED',
      errorStage: stage,
      requestId,
      clientRequestId,
    });
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

// ── OPTIONS preflight for all /api/* routes ───────────────────────────────────
app.options(/^\/api\/.*$/, (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.sendStatus(200);
});

// ── Lazy-load solve/submit handlers ───────────────────────────────────────────
let _solveHandler;
let _submitHandler;

/**
 * Returns the solveHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getSolveHandler = async () => {
  if (!_solveHandler) {
    const mod = await import('./backend/handlers/solveHandler.js');
    _solveHandler = mod.handler;
  }
  return _solveHandler;
};

/**
 * Returns the submitHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getSubmitHandler = async () => {
  if (!_submitHandler) {
    const mod = await import('./backend/handlers/submitHandler.js');
    _submitHandler = mod.handler;
  }
  return _submitHandler;
};

// ── GET /api/solve/:worksheetId ────────────────────────────────────────────────
app.get('/api/solve/:worksheetId', async (req, res) => {
  try {
    const fn = await getSolveHandler();
    const result = await fn(
      { httpMethod: 'GET', pathParameters: { worksheetId: req.params.worksheetId } },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('solve route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/submit ───────────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  try {
    const fn = await getSubmitHandler();
    const result = await fn(
      { httpMethod: 'POST', body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('submit route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Lazy-load Phase 3 handlers ────────────────────────────────────────────────
let _authHandler;
let _studentHandler;
let _progressHandler;
let _classHandler;
let _analyticsHandler;

/**
 * Returns the authHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getAuthHandler = async () => {
  if (!_authHandler) {
    const mod = await import('./backend/handlers/authHandler.js');
    _authHandler = mod.handler;
  }
  return _authHandler;
};

/**
 * Returns the studentHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getStudentHandler = async () => {
  if (!_studentHandler) {
    const mod = await import('./backend/handlers/studentHandler.js');
    _studentHandler = mod.handler;
  }
  return _studentHandler;
};

/**
 * Returns the progressHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getProgressHandler = async () => {
  if (!_progressHandler) {
    const mod = await import('./backend/handlers/progressHandler.js');
    _progressHandler = mod.handler;
  }
  return _progressHandler;
};

/**
 * Returns the classHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getClassHandler = async () => {
  if (!_classHandler) {
    const mod = await import('./backend/handlers/classHandler.js');
    _classHandler = mod.handler;
  }
  return _classHandler;
};

/**
 * Returns the analyticsHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getAnalyticsHandler = async () => {
  if (!_analyticsHandler) {
    const mod = await import('./backend/handlers/analyticsHandler.js');
    _analyticsHandler = mod.handler;
  }
  return _analyticsHandler;
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/register', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/login', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/logout', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/student/profile ──────────────────────────────────────────────────
app.get('/api/student/profile', async (req, res) => {
  try {
    const fn = await getStudentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/student/profile', headers: req.headers, body: null },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/student/join-class ──────────────────────────────────────────────
app.post('/api/student/join-class', async (req, res) => {
  try {
    const fn = await getStudentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/student/join-class', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/progress/save ───────────────────────────────────────────────────
app.post('/api/progress/save', async (req, res) => {
  try {
    const fn = await getProgressHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/progress/save', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('progress route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/progress/history ─────────────────────────────────────────────────
app.get('/api/progress/history', async (req, res) => {
  try {
    const fn = await getProgressHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/progress/history', headers: req.headers, body: null },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('progress route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/class/create ────────────────────────────────────────────────────
app.post('/api/class/create', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/class/create', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('class route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/class/:id/students ───────────────────────────────────────────────
app.get('/api/class/:id/students', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/class/${req.params.id}/students`, headers: req.headers, body: null, pathParameters: { id: req.params.id } },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('class route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/analytics/class/:id ─────────────────────────────────────────────
app.get('/api/analytics/class/:id', async (req, res) => {
  try {
    const fn = await getAnalyticsHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/analytics/class/${req.params.id}`, headers: req.headers, body: null, pathParameters: { id: req.params.id } },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('analytics route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Lazy-load rewardsHandler ──────────────────────────────────────────────────
let _rewardsHandler;

/**
 * Returns the rewardsHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getRewardsHandler = async () => {
  if (!_rewardsHandler) {
    const mod = await import('./backend/handlers/rewardsHandler.js');
    _rewardsHandler = mod.handler;
  }
  return _rewardsHandler;
};

// ── GET /api/rewards/student/:id ──────────────────────────────────────────────
app.get('/api/rewards/student/:id', async (req, res) => {
  try {
    const fn = await getRewardsHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/rewards/student/${req.params.id}`, headers: req.headers, pathParameters: { id: req.params.id }, body: null },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('rewards route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/rewards/class/:id ────────────────────────────────────────────────
app.get('/api/rewards/class/:id', async (req, res) => {
  try {
    const fn = await getRewardsHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/rewards/class/${req.params.id}`, headers: req.headers, pathParameters: { id: req.params.id }, body: null },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('rewards class route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// JSON fallback for unknown API routes (prevents HTML fallback responses)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    return res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  }
  return next();
});

// Fallback for SPA (non-API paths only)
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nLearnfyra — local dev server`);
  console.log(`  App:   http://localhost:${PORT}`);
  console.log(`  Files: ${LOCAL_FILES_DIR}`);
  console.log('\nReady. Open the URL above in your browser.\n');
});
