/**
 * @file server.js
 * @description API-only backend server. Exposes /api/* routes backed by the
 * real generators — no AWS/S3 needed. No frontend is served from this port.
 *
 * Usage:
 *   LEARNFYRA_ENV=dev node server.js   # fetches config from AWS dev (recommended)
 *   node server.js                      # falls back to .env if AWS unavailable
 *   cd learnfyra-app && npm run dev     # starts React frontend on http://localhost:5173
 */

// 1. Try loading config from AWS (SSM + Lambda env vars) — sets process.env.*
//    before dotenv runs, so AWS values take priority over .env
import { loadAwsConfig } from './scripts/load-aws-config.js';
await loadAwsConfig();

// 2. dotenv fills in any remaining vars from .env (won't override AWS values)
import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const LOCAL_FILES_DIR = join(__dirname, 'worksheets-local');

// Shared CORS headers applied on every response (success and error paths)
const CORS_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
};

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
const { getDbAdapter }      = await import('./src/db/index.js');
const { validateToken: extractToken } = await import('./backend/middleware/authMiddleware.js');

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
app.use(morgan('dev'));
app.use(express.json());

// Global CORS — sets headers on every /api response so individual routes don't need to
app.use('/api', (_req, res, next) => {
  res.set(corsHeaders);
  next();
});

// Serve locally generated worksheet files for download
app.use('/local-files', (_req, res, next) => {
  res.set(corsHeaders);
  next();
}, express.static(LOCAL_FILES_DIR));

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

    // Generate SEO slug for this worksheet
    stage = 'worksheet:generate-slug';
    const { generateWorksheetSlug } = await import('./src/utils/slugify.js');
    const slug = generateWorksheetSlug(grade, subject, topic, difficulty, uuid);

    // Save solve-data.json for the online solve feature
    stage = 'worksheet:write-solve-data';
    const solveData = {
      worksheetId: uuid,
      slug,
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

    // Write slug index for local slug-based lookups
    const slugIndexPath = join(LOCAL_FILES_DIR, 'slug-index.json');
    let slugIndex = {};
    try { slugIndex = JSON.parse(readFileSync(slugIndexPath, 'utf8')); } catch { /* first run */ }
    slugIndex[slug] = uuid;
    writeFileSync(slugIndexPath, JSON.stringify(slugIndex, null, 2));
    logGenerateEvent('info', 'server solve data written', {
      requestId,
      clientRequestId,
      stage,
      elapsedMs: Date.now() - requestStart,
      solveDataPath: join(outputDir, 'solve-data.json'),
    });

    // Save worksheet record to DB so it appears in "My Worksheets" immediately
    stage = 'worksheet:save-record';
    let createdBy = 'anonymous';
    try {
      const decoded = await extractToken({ headers: { authorization: req.get('authorization') || '' } });
      if (decoded?.sub) createdBy = decoded.sub;
    } catch { /* unauthenticated — use anonymous */ }

    try {
      const db = getDbAdapter();
      await db.putItem('worksheets', {
        worksheetId: uuid,
        slug,
        grade,
        subject,
        topic,
        difficulty,
        title: worksheet.title || `${topic} — Grade ${grade}`,
        questionCount,
        estimatedTime: worksheet.estimatedTime || '20 minutes',
        totalPoints: worksheet.totalPoints,
        createdBy,
        createdAt: new Date().toISOString(),
      });
    } catch (dbErr) {
      // Non-fatal: worksheet files are already written
      console.error('server worksheet record save failed (non-fatal):', dbErr.message || dbErr);
    }

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
      slug,
      requestId,
      clientRequestId,
      metadata: {
        id: uuid,
        slug,
        solveUrl: `/solve/${slug}`,
        solveUrlUuid: `/solve/${uuid}`,
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
  res.set('Access-Control-Allow-Headers', 'Content-Type,X-Amz-Date,Authorization');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.sendStatus(200);
});

// ── Lazy-load solve/submit handlers ───────────────────────────────────────────
let _solveHandler;
let _submitHandler;
let _generateQuestionsHandler;

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

const getGenerateQuestionsHandler = async () => {
  if (!_generateQuestionsHandler) {
    const mod = await import('./backend/handlers/generateQuestionsHandler.js');
    _generateQuestionsHandler = mod.handler;
  }
  return _generateQuestionsHandler;
};

// ── POST /api/generate-questions ──────────────────────────────────────────────
app.post('/api/generate-questions', async (req, res) => {
  try {
    const fn = await getGenerateQuestionsHandler();
    const result = await fn(
      { httpMethod: 'POST', body: JSON.stringify(req.body) },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('generate-questions route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/solve/:worksheetId ────────────────────────────────────────────────
app.get('/api/solve/:worksheetId', async (req, res) => {
  try {
    const fn = await getSolveHandler();
    const result = await fn(
      { httpMethod: 'GET', pathParameters: { worksheetId: req.params.worksheetId }, queryStringParameters: req.query },
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
let _guestFixtureHandler;
let _studentHandler;
let _progressHandler;
let _dashboardHandler;
let _classHandler;
let _analyticsHandler;
let _certificatesHandler;
let _adminHandler;

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

const getGuestFixtureHandler = async () => {
  if (!_guestFixtureHandler) {
    const mod = await import('./backend/handlers/guestFixtureHandler.js');
    _guestFixtureHandler = mod.handler;
  }
  return _guestFixtureHandler;
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
 * Returns the dashboardHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getDashboardHandler = async () => {
  if (!_dashboardHandler) {
    const mod = await import('./backend/handlers/dashboardHandler.js');
    _dashboardHandler = mod.handler;
  }
  return _dashboardHandler;
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

/**
 * Returns the certificatesHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getCertificatesHandler = async () => {
  if (!_certificatesHandler) {
    const mod = await import('./backend/handlers/certificatesHandler.js');
    _certificatesHandler = mod.handler;
  }
  return _certificatesHandler;
};

/**
 * Returns the adminHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getAdminHandler = async () => {
  if (!_adminHandler) {
    const mod = await import('./backend/handlers/adminHandler.js');
    _adminHandler = mod.handler;
  }
  return _adminHandler;
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/register', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
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
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
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
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/refresh', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth refresh route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/guest ──────────────────────────────────────────────────────
app.post('/api/auth/guest', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/guest', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders);
    // Forward Set-Cookie from handler (Lambda response → Express)
    if (result.headers?.['Set-Cookie']) {
      res.setHeader('Set-Cookie', result.headers['Set-Cookie']);
    }
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth guest route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/guest/preview ───────────────────────────────────────────────────
app.get('/api/guest/preview', async (req, res) => {
  try {
    const fn = await getGuestFixtureHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/guest/preview',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
      },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('guest preview route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/forgot-password', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth forgot-password route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/reset-password', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth reset-password route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/request-consent ───────────────────────────────────────────
app.post('/api/auth/request-consent', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/request-consent', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth request-consent route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/verify-consent ────────────────────────────────────────────
app.post('/api/auth/verify-consent', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/verify-consent', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth verify-consent route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/deny-consent ───────────────────────────────────────────────
app.post('/api/auth/deny-consent', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/deny-consent', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth deny-consent route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── PATCH /api/auth/verify-age ────────────────────────────────────────────────
app.patch('/api/auth/verify-age', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      { httpMethod: 'PATCH', path: '/api/auth/verify-age', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth verify-age route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/oauth/:provider ────────────────────────────────────────────
app.post('/api/auth/oauth/:provider', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      {
        httpMethod: 'POST',
        path: `/api/auth/oauth/${req.params.provider}`,
        headers: req.headers,
        body: JSON.stringify(req.body),
      },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth oauth route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/auth/callback/:provider ──────────────────────────────────────────
// The handler now returns a 302 redirect directly — just forward it.
app.get('/api/auth/callback/:provider', async (req, res) => {
  try {
    const fn = await getAuthHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: `/api/auth/callback/${req.params.provider}`,
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
      },
      {},
    );

    if (result.statusCode === 302 && result.headers?.Location) {
      return res.set(corsHeaders).redirect(result.headers.Location);
    }

    // Fallback: forward status + body as-is
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth callback route error:', err);
    const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorMsg = encodeURIComponent('Authentication failed. Please try again.');
    return res.redirect(`${frontendOrigin}/?authError=${errorMsg}`);
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

// ── PATCH /api/student/profile ───────────────────────────────────────────────
app.patch('/api/student/profile', async (req, res) => {
  try {
    const fn = await getStudentHandler();
    const result = await fn(
      { httpMethod: 'PATCH', path: '/api/student/profile', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
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

// ── GET /api/worksheets/mine ──────────────────────────────────────────────────
app.get('/api/worksheets/mine', async (req, res) => {
  try {
    const fn = await getProgressHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/worksheets/mine',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('worksheets/mine route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/progress/history ─────────────────────────────────────────────────
app.get('/api/progress/history', async (req, res) => {
  try {
    const fn = await getProgressHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/progress/history',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('progress route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/progress/insights ───────────────────────────────────────────────
app.get('/api/progress/insights', async (req, res) => {
  try {
    const fn = await getProgressHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/progress/insights',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('progress route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/progress/parent/:childId ────────────────────────────────────────
app.get('/api/progress/parent/:childId', async (req, res) => {
  try {
    const fn = await getProgressHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: `/api/progress/parent/${req.params.childId}`,
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
        pathParameters: { childId: req.params.childId },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('progress route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/dashboard/stats ──────────────────────────────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const fn = await getDashboardHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/dashboard/stats', headers: req.headers, body: null },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('dashboard route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/dashboard/recent-worksheets ─────────────────────────────────────
app.get('/api/dashboard/recent-worksheets', async (req, res) => {
  try {
    const fn = await getDashboardHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/dashboard/recent-worksheets', headers: req.headers, body: null },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('dashboard route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/dashboard/subject-progress ──────────────────────────────────────
app.get('/api/dashboard/subject-progress', async (req, res) => {
  try {
    const fn = await getDashboardHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/dashboard/subject-progress', headers: req.headers, body: null },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('dashboard route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
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

// ── GET /api/analytics/student/:id ───────────────────────────────────────────
app.get('/api/analytics/student/:id', async (req, res) => {
  try {
    const fn = await getAnalyticsHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: `/api/analytics/student/${req.params.id}`,
        headers: req.headers,
        body: null,
        pathParameters: { id: req.params.id },
        queryStringParameters: req.query,
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('analytics route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/certificates ─────────────────────────────────────────────────────
app.get('/api/certificates', async (req, res) => {
  try {
    const fn = await getCertificatesHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/certificates',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('certificates route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/certificates/:id/download ───────────────────────────────────────
app.get('/api/certificates/:id/download', async (req, res) => {
  try {
    const fn = await getCertificatesHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: `/api/certificates/${req.params.id}/download`,
        headers: req.headers,
        body: null,
        pathParameters: { id: req.params.id },
        queryStringParameters: req.query,
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('certificates route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/admin/policies ──────────────────────────────────────────────────
app.get('/api/admin/policies', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/admin/policies',
        headers: req.headers,
        body: null,
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/policies/model-routing ───────────────────────────────────
app.put('/api/admin/policies/model-routing', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/model-routing',
        headers: req.headers,
        body: JSON.stringify(req.body),
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/policies/budget-usage ────────────────────────────────────
app.put('/api/admin/policies/budget-usage', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/budget-usage',
        headers: req.headers,
        body: JSON.stringify(req.body),
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/policies/validation-profile ──────────────────────────────
app.put('/api/admin/policies/validation-profile', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/validation-profile',
        headers: req.headers,
        body: JSON.stringify(req.body),
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/admin/policies/repeat-cap ─────────────────────────────────────
app.get('/api/admin/policies/repeat-cap', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/admin/policies/repeat-cap',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/policies/repeat-cap ─────────────────────────────────────
app.put('/api/admin/policies/repeat-cap', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/repeat-cap',
        headers: req.headers,
        body: JSON.stringify(req.body),
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/policies/repeat-cap/overrides ───────────────────────────
app.put('/api/admin/policies/repeat-cap/overrides', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'PUT',
        path: '/api/admin/policies/repeat-cap/overrides',
        headers: req.headers,
        body: JSON.stringify(req.body),
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/admin/audit/events ──────────────────────────────────────────────
app.get('/api/admin/audit/events', async (req, res) => {
  try {
    const fn = await getAdminHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/admin/audit/events',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
        requestContext: { requestId: randomUUID() },
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('admin route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── M07 Admin Routes (user mgmt, question bank, cost, config, schools, audit) ─

/** Generic admin route helper — forwards Express request to adminHandler Lambda */
function adminRoute(method, expressPath, lambdaPath) {
  const httpMethod = method.toUpperCase();
  const fn = method === 'delete' ? 'delete' : method;
  app[fn](expressPath, async (req, res) => {
    try {
      const handler = await getAdminHandler();
      const path = typeof lambdaPath === 'function' ? lambdaPath(req) : lambdaPath;
      const result = await handler(
        {
          httpMethod,
          path,
          headers: req.headers,
          body: req.body ? JSON.stringify(req.body) : null,
          queryStringParameters: req.query && Object.keys(req.query).length ? req.query : null,
          pathParameters: req.params || null,
          requestContext: { requestId: randomUUID(), identity: { sourceIp: req.ip } },
        },
        { callbackWaitsForEmptyEventLoop: true, functionName: 'learnfyra-admin-local', getRemainingTimeInMillis: () => 15000 },
      );
      res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
    } catch (err) {
      console.error('admin route error:', err);
      res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
    }
  });
}

// User management
adminRoute('get',    '/api/admin/users',                          '/api/admin/users');
adminRoute('get',    '/api/admin/users/:userId',                  r => `/api/admin/users/${r.params.userId}`);
adminRoute('patch',  '/api/admin/users/:userId/suspend',          r => `/api/admin/users/${r.params.userId}/suspend`);
adminRoute('patch',  '/api/admin/users/:userId/unsuspend',        r => `/api/admin/users/${r.params.userId}/unsuspend`);
adminRoute('post',   '/api/admin/users/:userId/force-logout',     r => `/api/admin/users/${r.params.userId}/force-logout`);
adminRoute('patch',  '/api/admin/users/:userId/role',             r => `/api/admin/users/${r.params.userId}/role`);
adminRoute('delete', '/api/admin/users/:userId',                  r => `/api/admin/users/${r.params.userId}`);

// Question bank moderation
adminRoute('get',    '/api/admin/question-bank',                  '/api/admin/question-bank');
adminRoute('patch',  '/api/admin/question-bank/:questionId/flag', r => `/api/admin/question-bank/${r.params.questionId}/flag`);
adminRoute('patch',  '/api/admin/question-bank/:questionId/unflag', r => `/api/admin/question-bank/${r.params.questionId}/unflag`);
adminRoute('delete', '/api/admin/question-bank/:questionId',      r => `/api/admin/question-bank/${r.params.questionId}`);

// Cost dashboard
adminRoute('get',    '/api/admin/cost-dashboard',                 '/api/admin/cost-dashboard');
adminRoute('get',    '/api/admin/cost-dashboard/top-expensive',   '/api/admin/cost-dashboard/top-expensive');

// Config management
adminRoute('get',    '/api/admin/config',                         '/api/admin/config');
adminRoute('get',    '/api/admin/config/:configType',             r => `/api/admin/config/${r.params.configType}`);
adminRoute('put',    '/api/admin/config/:configType',             r => `/api/admin/config/${r.params.configType}`);

// School management
adminRoute('post',   '/api/admin/schools',                        '/api/admin/schools');
adminRoute('get',    '/api/admin/schools',                        '/api/admin/schools');
adminRoute('get',    '/api/admin/schools/:schoolId',              r => `/api/admin/schools/${r.params.schoolId}`);
adminRoute('patch',  '/api/admin/schools/:schoolId',              r => `/api/admin/schools/${r.params.schoolId}`);

// Audit & compliance log
adminRoute('get',    '/api/admin/audit-log',                      '/api/admin/audit-log');
adminRoute('get',    '/api/admin/compliance-log',                 '/api/admin/compliance-log');

// ── M07 School Admin Routes (/school/*) ─────────────────────────────────────

let _schoolAdminHandler;
const getSchoolAdminHandler = async () => {
  if (!_schoolAdminHandler) {
    const mod = await import('./backend/handlers/schoolAdminHandler.js');
    _schoolAdminHandler = mod.handler;
  }
  return _schoolAdminHandler;
};

function schoolRoute(method, expressPath, lambdaPath) {
  const httpMethod = method.toUpperCase();
  const fn = method === 'delete' ? 'delete' : method;
  app[fn](expressPath, async (req, res) => {
    try {
      const handler = await getSchoolAdminHandler();
      const path = typeof lambdaPath === 'function' ? lambdaPath(req) : lambdaPath;
      const result = await handler(
        {
          httpMethod,
          path,
          headers: req.headers,
          body: req.body ? JSON.stringify(req.body) : null,
          queryStringParameters: req.query && Object.keys(req.query).length ? req.query : null,
          pathParameters: req.params || null,
          requestContext: { requestId: randomUUID(), identity: { sourceIp: req.ip } },
        },
        { callbackWaitsForEmptyEventLoop: true, functionName: 'learnfyra-school-admin-local', getRemainingTimeInMillis: () => 15000 },
      );
      res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
    } catch (err) {
      console.error('school admin route error:', err);
      res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
    }
  });
}

schoolRoute('get',    '/school/teachers',               '/school/teachers');
schoolRoute('post',   '/school/teachers/invite',        '/school/teachers/invite');
schoolRoute('delete', '/school/teachers/:userId',       r => `/school/teachers/${r.params.userId}`);
schoolRoute('get',    '/school/students',               '/school/students');
schoolRoute('get',    '/school/analytics',              '/school/analytics');
schoolRoute('post',   '/school/bulk-assign',            '/school/bulk-assign');
schoolRoute('get',    '/school/config',                 '/school/config');
schoolRoute('patch',  '/school/config',                 '/school/config');

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

// ── Lazy-load feedbackHandler ────────────────────────────────────────────────
let _feedbackHandler;

const getFeedbackHandler = async () => {
  if (!_feedbackHandler) {
    const mod = await import('./backend/handlers/feedbackHandler.js');
    _feedbackHandler = mod.handler;
  }
  return _feedbackHandler;
};

// ── POST /api/feedback ──────────────────────────────────────────────────────
app.post('/api/feedback', async (req, res) => {
  try {
    const fn = await getFeedbackHandler();
    const result = await fn(
      {
        httpMethod: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
      },
      {},
    );
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('feedback route error:', err);
    res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Lazy-load questionBankHandler ────────────────────────────────────────────
let _questionBankHandler;

/**
 * Returns the questionBankHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getQuestionBankHandler = async () => {
  if (!_questionBankHandler) {
    const mod = await import('./backend/handlers/questionBankHandler.js');
    _questionBankHandler = mod.handler;
  }
  return _questionBankHandler;
};

// ── GET /api/qb/questions ─────────────────────────────────────────────────────
app.get('/api/qb/questions', async (req, res) => {
  try {
    const fn = await getQuestionBankHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: '/api/qb/questions',
        headers: req.headers,
        body: null,
        queryStringParameters: req.query,
        pathParameters: null,
      },
      { callbackWaitsForEmptyEventLoop: true, functionName: 'learnfyra-qb-local', getRemainingTimeInMillis: () => 30000 },
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('question bank list route error:', err);
    res.set(corsHeaders).status(500).json({ code: 'QB_INTERNAL', error: 'Internal server error.' });
  }
});

// ── POST /api/qb/questions ────────────────────────────────────────────────────
app.post('/api/qb/questions', async (req, res) => {
  try {
    const fn = await getQuestionBankHandler();
    const result = await fn(
      {
        httpMethod: 'POST',
        path: '/api/qb/questions',
        headers: req.headers,
        body: JSON.stringify(req.body),
        queryStringParameters: null,
        pathParameters: null,
      },
      { callbackWaitsForEmptyEventLoop: true, functionName: 'learnfyra-qb-local', getRemainingTimeInMillis: () => 30000 },
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('question bank add route error:', err);
    res.set(corsHeaders).status(500).json({ code: 'QB_INTERNAL', error: 'Internal server error.' });
  }
});

// ── POST /api/qb/questions/:id/reuse ─────────────────────────────────────────
app.post('/api/qb/questions/:id/reuse', async (req, res) => {
  try {
    const fn = await getQuestionBankHandler();
    const result = await fn(
      {
        httpMethod: 'POST',
        path: `/api/qb/questions/${req.params.id}/reuse`,
        headers: req.headers,
        body: null,
        queryStringParameters: null,
        pathParameters: { id: req.params.id },
      },
      { callbackWaitsForEmptyEventLoop: true, functionName: 'learnfyra-qb-local', getRemainingTimeInMillis: () => 30000 },
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('question bank reuse route error:', err);
    res.set(corsHeaders).status(500).json({ code: 'QB_INTERNAL', error: 'Internal server error.' });
  }
});

// ── GET /api/qb/questions/:id ─────────────────────────────────────────────────
app.get('/api/qb/questions/:id', async (req, res) => {
  try {
    const fn = await getQuestionBankHandler();
    const result = await fn(
      {
        httpMethod: 'GET',
        path: `/api/qb/questions/${req.params.id}`,
        headers: req.headers,
        body: null,
        queryStringParameters: null,
        pathParameters: { id: req.params.id },
      },
      { callbackWaitsForEmptyEventLoop: true, functionName: 'learnfyra-qb-local', getRemainingTimeInMillis: () => 30000 },
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('question bank get-by-id route error:', err);
    res.set(corsHeaders).status(500).json({ code: 'QB_INTERNAL', error: 'Internal server error.' });
  }
});

// ── M05 — Lazy-load new handlers ─────────────────────────────────────────────
let _assignmentHandler;
let _reviewQueueHandler;
let _parentHandler;

const getAssignmentHandler = async () => {
  if (!_assignmentHandler) {
    const mod = await import('./backend/handlers/assignmentHandler.js');
    _assignmentHandler = mod.handler;
  }
  return _assignmentHandler;
};

const getReviewQueueHandler = async () => {
  if (!_reviewQueueHandler) {
    const mod = await import('./backend/handlers/reviewQueueHandler.js');
    _reviewQueueHandler = mod.handler;
  }
  return _reviewQueueHandler;
};

const getParentHandler = async () => {
  if (!_parentHandler) {
    const mod = await import('./backend/handlers/parentHandler.js');
    _parentHandler = mod.handler;
  }
  return _parentHandler;
};

// ── M05 Teacher — Class Management ───────────────────────────────────────────
app.post('/api/classes', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/classes', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('classes route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/classes', headers: req.headers, body: null },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('classes route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/classes/:classId', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('classes route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.patch('/api/classes/:classId', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'PATCH', path: `/api/classes/${req.params.classId}`, headers: req.headers, body: JSON.stringify(req.body), pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('classes route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/classes/:classId/archive', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'DELETE', path: `/api/classes/${req.params.classId}/archive`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('classes archive route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/classes/:classId/invite', async (req, res) => {
  try {
    const fn = await getClassHandler();
    const result = await fn(
      { httpMethod: 'POST', path: `/api/classes/${req.params.classId}/invite`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('classes invite route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Teacher — Roster Management ──────────────────────────────────────────
app.get('/api/classes/:classId/students', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}/students`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('class students route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/classes/:classId/students/:studentId', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'DELETE', path: `/api/classes/${req.params.classId}/students/${req.params.studentId}`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId, studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('class remove-student route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/classes/:classId/students/:studentId/parent-invite', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: `/api/classes/${req.params.classId}/students/${req.params.studentId}/parent-invite`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId, studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('class parent-invite route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Teacher — Assignment Management ──────────────────────────────────────
app.post('/api/assignments', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/assignments', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('assignments route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/assignments/:assignmentId', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/assignments/${req.params.assignmentId}`, headers: req.headers, body: null, pathParameters: { assignmentId: req.params.assignmentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('assignment detail route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/classes/:classId/assignments', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}/assignments`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('class assignments route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.patch('/api/assignments/:assignmentId', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'PATCH', path: `/api/assignments/${req.params.assignmentId}`, headers: req.headers, body: JSON.stringify(req.body), pathParameters: { assignmentId: req.params.assignmentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('assignment patch route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/assignments/:assignmentId/close', async (req, res) => {
  try {
    const fn = await getAssignmentHandler();
    const result = await fn(
      { httpMethod: 'DELETE', path: `/api/assignments/${req.params.assignmentId}/close`, headers: req.headers, body: null, pathParameters: { assignmentId: req.params.assignmentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('assignment close route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Teacher — Review Queue ────────────────────────────────────────────────
app.get('/api/classes/:classId/review-queue', async (req, res) => {
  try {
    const fn = await getReviewQueueHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}/review-queue`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('review-queue route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/review-queue/:reviewId/resolve', async (req, res) => {
  try {
    const fn = await getReviewQueueHandler();
    const result = await fn(
      { httpMethod: 'POST', path: `/api/review-queue/${req.params.reviewId}/resolve`, headers: req.headers, body: JSON.stringify(req.body), pathParameters: { reviewId: req.params.reviewId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('review-queue resolve route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Teacher — Analytics ───────────────────────────────────────────────────
app.get('/api/classes/:classId/analytics/heatmap', async (req, res) => {
  try {
    const fn = await getAnalyticsHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}/analytics/heatmap`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('analytics heatmap route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/classes/:classId/analytics', async (req, res) => {
  try {
    const fn = await getAnalyticsHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}/analytics`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('analytics route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/classes/:classId/students/:studentId/progress', async (req, res) => {
  try {
    const fn = await getAnalyticsHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/classes/${req.params.classId}/students/${req.params.studentId}/progress`, headers: req.headers, body: null, pathParameters: { classId: req.params.classId, studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student progress route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Parent routes ─────────────────────────────────────────────────────────
app.post('/api/parent/link', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/parent/link', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent link route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/parent/children', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/parent/children', headers: req.headers, body: null },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent children route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/parent/children/:studentId', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'DELETE', path: `/api/parent/children/${req.params.studentId}`, headers: req.headers, body: null, pathParameters: { studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent unlink route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/parent/children/:studentId/progress', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/parent/children/${req.params.studentId}/progress`, headers: req.headers, body: null, pathParameters: { studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent child-progress route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/parent/children/:studentId/assignments', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/parent/children/${req.params.studentId}/assignments`, headers: req.headers, body: null, pathParameters: { studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent child-assignments route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/parent/children/:studentId/export ───────────────────────────────
app.get('/api/parent/children/:studentId/export', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/parent/children/${req.params.studentId}/export`, headers: req.headers, body: null, pathParameters: { studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent export route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/parent/children/:studentId/revoke-consent ──────────────────────
app.post('/api/parent/children/:studentId/revoke-consent', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: `/api/parent/children/${req.params.studentId}/revoke-consent`, headers: req.headers, body: JSON.stringify(req.body), pathParameters: { studentId: req.params.studentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('parent revoke-consent route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/child-session ──────────────────────────────────────────────
app.post('/api/auth/child-session', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/auth/child-session', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('child-session route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Student — Class Participation ────────────────────────────────────────
app.post('/api/student/classes/join', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/student/classes/join', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student join-class route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/student/parent-invite', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/student/parent-invite', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student parent-invite route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/student/assignments', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: '/api/student/assignments', headers: req.headers, body: null },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student assignments route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/student/assignments/:assignmentId', async (req, res) => {
  try {
    const fn = await getParentHandler();
    const result = await fn(
      { httpMethod: 'GET', path: `/api/student/assignments/${req.params.assignmentId}`, headers: req.headers, body: null, pathParameters: { assignmentId: req.params.assignmentId } },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('student assignment detail route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── M05 Auth — Role Upgrade ───────────────────────────────────────────────────
app.post('/api/user/role/upgrade', async (req, res) => {
  try {
    const fn = await getStudentHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/user/role/upgrade', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('role upgrade route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// ── Account Lifecycle (COPPA/CCPA deletion) ───────────────────────────────────
let _accountHandler;

/**
 * Returns the accountHandler function, importing it on first call.
 * @returns {Promise<Function>}
 */
const getAccountHandler = async () => {
  if (!_accountHandler) {
    const mod = await import('./backend/handlers/accountHandler.js');
    _accountHandler = mod.handler;
  }
  return _accountHandler;
};

// DELETE /api/account — request self-deletion (7-day grace period)
app.delete('/api/account', async (req, res) => {
  try {
    const fn = await getAccountHandler();
    const result = await fn(
      { httpMethod: 'DELETE', path: '/api/account', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('account delete route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/account/cancel-deletion — cancel a pending deletion
app.post('/api/account/cancel-deletion', async (req, res) => {
  try {
    const fn = await getAccountHandler();
    const result = await fn(
      { httpMethod: 'POST', path: '/api/account/cancel-deletion', headers: req.headers, body: JSON.stringify(req.body) },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('account cancel-deletion route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/account/child/:childUserId — parent deletes child account immediately
app.delete('/api/account/child/:childUserId', async (req, res) => {
  try {
    const fn = await getAccountHandler();
    const result = await fn(
      {
        httpMethod: 'DELETE',
        path: `/api/account/child/${req.params.childUserId}`,
        headers: req.headers,
        body: JSON.stringify(req.body),
        pathParameters: { childUserId: req.params.childUserId },
      },
      {},
    );
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('account child-delete route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
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

// Non-API requests return 404 — frontend is served by Vite (port 5173), not Express.
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
  res.status(404).json({ error: 'Frontend is served by Vite on port 5173. This server handles API routes only.' });
});

app.listen(PORT, () => {
  console.log(`\nLearnfyra — API server (backend only)`);
  console.log(`  API:      http://localhost:${PORT}/api`);
  console.log(`  Files:    ${LOCAL_FILES_DIR}`);
  console.log(`  Frontend: http://localhost:5173 (run Vite separately)`);
  console.log('\nReady. API routes only — no frontend served from this port.\n');
});
