/**
 * @file tests/integration/questionBankRoutes.test.js
 * @description Integration tests for question bank Express routes in server.js.
 * Starts the real local server on a random port, exercises the HTTP endpoints,
 * then shuts the process down after the suite.
 * @agent QA
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import { createServer } from 'net';

let serverProcess;
let baseUrl;
let createdQuestion;

const testQuestion = {
  grade: 4,
  subject: 'Math',
  topic: 'Factors',
  difficulty: 'Easy',
  type: 'multiple-choice',
  question: `Which number is a factor of 24? ${Date.now()}`,
  options: ['A. 5', 'B. 6', 'C. 7', 'D. 11'],
  answer: 'B',
  explanation: '6 divides 24 evenly.',
  standards: ['CCSS.MATH.CONTENT.4.OA.B.4'],
  modelUsed: 'integration-test',
};

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/qb/questions`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

beforeAll(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;

  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-key',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let startupError = '';
  serverProcess.stderr.on('data', (chunk) => {
    startupError += chunk.toString();
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && !startupError) {
      startupError = `Server exited early with code ${code}.`;
    }
  });

  try {
    await waitForServer(baseUrl);
  } catch (error) {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
    throw new Error(startupError || error.message);
  }
}, 20000);

afterAll(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

describe('question bank Express routes', () => {
  it('POST /api/qb/questions creates a question through the local server route', async () => {
    const response = await fetch(`${baseUrl}/api/qb/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testQuestion),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBeDefined();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.question).toHaveProperty('questionId');
    expect(body.question.question).toBe(testQuestion.question);

    createdQuestion = body.question;
  });

  it('GET /api/qb/questions returns the created question when filters match', async () => {
    const query = new URLSearchParams({
      grade: String(testQuestion.grade),
      subject: testQuestion.subject,
      topic: testQuestion.topic,
      difficulty: testQuestion.difficulty,
      type: testQuestion.type,
    });

    const response = await fetch(`${baseUrl}/api/qb/questions?${query.toString()}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.count).toBeGreaterThanOrEqual(1);

    const matched = body.questions.find((question) => question.questionId === createdQuestion.questionId);
    expect(matched).toBeDefined();
    expect(matched.subject).toBe(testQuestion.subject);
  });

  it('GET /api/qb/questions/:id returns the created question by id', async () => {
    const response = await fetch(`${baseUrl}/api/qb/questions/${createdQuestion.questionId}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.question.questionId).toBe(createdQuestion.questionId);
    expect(body.question.explanation).toBe(testQuestion.explanation);
  });
});