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

// Shared CORS headers applied on every response (success and error paths)
const CORS_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
    const outputDir = join(LOCAL_FILES_DIR, uuid);
    mkdirSync(outputDir, { recursive: true });

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
    const worksheetKey = `local/${uuid}/${worksheetFilename}`;

    // Save solve-data.json for the online solve feature
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

    // Export answer key if requested
    let answerKeyKey = null;
    if (includeAnswerKey) {
      const answerKeyPaths = await exportAnswerKey(worksheet, exportOpts);
      if (answerKeyPaths.length > 0) {
        const answerKeyFilename = answerKeyPaths[0].split(/[\\/]/).pop();
        answerKeyKey = `local/${uuid}/${answerKeyFilename}`;
      }
    }

    res.json({
      success: true,
      worksheetKey,
      answerKeyKey,
      metadata: {
        id: uuid,
        solveUrl: `/solve.html?id=${uuid}`,
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

// ── OPTIONS preflight for all /api/* routes ───────────────────────────────────
app.options(/^\/api\/.*$/, (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type,X-Amz-Date,Authorization');
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
    res.set(corsHeaders).status(result.statusCode).json(JSON.parse(result.body));
  } catch (err) {
    console.error('auth callback route error:', err);
    res.set(corsHeaders).status(500).json({ error: 'Internal server error.' });
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
