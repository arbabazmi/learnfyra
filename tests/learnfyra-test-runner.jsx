import { useState, useRef, useCallback } from "react";

const SUITE_TIMEOUT_MS = 90000;
const HEARTBEAT_WARN_MS = 8000;

const ARCHITECTURE_CONTEXT = `
You are a senior QA engineer reviewing the Learnfyra EdTech platform.

SYSTEM:
- Frontend: React + TypeScript + Vite
- Auth: AWS Cognito + Google OAuth + Lambda Authorizer (JWT via JWKS)
- Backend: API Gateway → Lambda → DynamoDB + S3 + Step Functions
- AI: AWS Bedrock (Nova, Claude) for worksheet generation
- Infra: AWS CDK, multi-env (dev/qa/prod), CloudFront

KEY MODELS:
- Users: PK=USER#<sub>, email, name, role, provider, created_at
- QuestionBank: PK=QUESTION#<id>, SK=METADATA, subject, grade, topic, difficulty, questionText, options, correctAnswer, explanation
- Worksheet: PK=WORKSHEET#<id>, SK=METADATA, userId, grade, subject, topic, questions[], status
- WorksheetAttempt: PK=ATTEMPT#<id>, SK=METADATA, worksheetId, userId, answers, score, startedAt, submittedAt

CRITICAL FLOWS:
1. Auth: Google OAuth → Cognito → JWT → Lambda Authorizer → DynamoDB user upsert
2. Generation: POST /worksheet → Step Functions → [BankLookup → AIBatch(5) → Validate → Assemble] → S3
3. Solve: Start attempt → Auto-save → Submit → Score → Update UserProgress
`;

const TEST_SUITES = [
  {
    id: "auth-frontend", module: "Module 1", label: "Auth · Frontend & UI",
    color: "#6366f1", dimColor: "#6366f115", borderColor: "#6366f135", icon: "🔐", layer: "UI",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 1 - Authentication Frontend/UI. Be concise. Max 8 test cases.

Use EXACT format for each case:

[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// test code (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. Google OAuth button renders and triggers Cognito Hosted UI redirect
2. Callback handler stores Access Token (not ID token) in memory
3. First-login vs returning-user branching in auth hook
4. Token expiry → silent refresh or redirect to login
5. Auth gate blocks unauthenticated routes
6. OAuth cancellation shows error boundary
7. JWT claims (sub, email, token_use=access) parsed via context
8. Logout clears all token state and redirects home

Then output:
SUMMARY:
TOTAL: <n>
PASS: <n>
WARNINGS: <n>
CRITICAL_RISKS: <list>
RECOMMENDED_PRIORITY: <first test and why>`
  },
  {
    id: "auth-backend", module: "Module 1", label: "Auth · Lambda Authorizer",
    color: "#6366f1", dimColor: "#6366f115", borderColor: "#6366f135", icon: "🛡️", layer: "API",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 1 - Lambda Authorizer backend. Be concise. Max 10 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// jest test (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. Valid JWT → Allow policy with correct principalId and claims
2. Expired JWT → Deny, 401
3. Malformed JWT → Deny without unhandled error
4. JWT signed with wrong key → Deny (JWKS failure)
5. ID token instead of Access Token → Deny
6. JWKS endpoint unreachable → fail closed
7. First-login: new user created PK=USER#sub, role=student
8. Returning user: record returned, no duplicate
9. None algorithm attack → rejected before JWKS fetch
10. Token from wrong Cognito pool → Deny

Then output:
SUMMARY:
TOTAL: <n>
PASS: <n>
WARNINGS: <n>
CRITICAL_SECURITY_RISKS: <list>`
  },
  {
    id: "generator-frontend", module: "Module 2", label: "Generator · Frontend UI",
    color: "#0ea5e9", dimColor: "#0ea5e915", borderColor: "#0ea5e935", icon: "⚡", layer: "UI",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 2 - Worksheet Generation Frontend. Be concise. Max 8 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// vitest/cypress test (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. Grade/subject/topic dropdowns populate correctly
2. Question count slider bounded 1-50, defaults to 10
3. Submit triggers POST /worksheet and shows PENDING spinner
4. Polling GET /worksheet/{id} continues until COMPLETED
5. COMPLETED state shows preview + S3 download URL
6. 500 error shows retry button
7. Form validation blocks submit with missing fields
8. Cancel during PENDING stops polling, returns to form

Then: SUMMARY: TOTAL, PASS, WARNINGS`
  },
  {
    id: "generator-backend", module: "Module 2", label: "Generator · Pipeline & API",
    color: "#0ea5e9", dimColor: "#0ea5e915", borderColor: "#0ea5e935", icon: "🔧", layer: "API",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 2 - Worksheet Generation backend. Be concise. Max 10 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// jest/aws-sdk mock (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. POST /worksheet validates input, returns 400 on invalid
2. POST /worksheet returns worksheetId + PENDING synchronously
3. QuestionBank GSI query runs BEFORE Bedrock call
4. AI generation batches exactly 5 questions per Bedrock call
5. Bedrock timeout → retry with backoff, max 3 attempts
6. Partial batch failure → only failed batch retried
7. Duplicate questionId not assembled twice
8. Topic with 0 Bank hits falls back to AI generation
9. GenerationLog written with tokensUsed, latency, status
10. GET /worksheet/{id} returns signed S3 URL when COMPLETED

Then: SUMMARY: TOTAL, PASS, WARNINGS, PIPELINE_BOTTLENECK`
  },
  {
    id: "solve-frontend", module: "Module 3", label: "Solve · Interactive UI",
    color: "#10b981", dimColor: "#10b98115", borderColor: "#10b98135", icon: "📝", layer: "UI",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 3 - Solve Engine Frontend. Be concise. Max 8 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// cypress/RTL (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. MCQ renders 4 options, only one selectable
2. Fill-in-blank trims whitespace before validation
3. Progress bar increments as questions answered
4. Practice mode: instant feedback after each answer
5. Test mode: feedback hidden until submit
6. Auto-save fires every 30s and on answer change
7. Timer triggers auto-submit at zero
8. Submit disabled until at least one answer given

Then: SUMMARY: TOTAL, PASS, WARNINGS`
  },
  {
    id: "solve-backend", module: "Module 3", label: "Solve · Attempt API",
    color: "#10b981", dimColor: "#10b98115", borderColor: "#10b98135", icon: "🎯", layer: "API",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 3 - Solve Engine backend. Be concise. Max 10 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// jest (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. POST /attempt creates WorksheetAttempt, returns attemptId + startedAt
2. PATCH /attempt/{id}/save accepts partial answers without scoring
3. POST /attempt/{id}/submit calculates score correctly
4. Submitted attempt is immutable — PATCH returns 409
5. Re-attempt creates NEW attempt record
6. MCQ exact match, fill-blank case-insensitive trim
7. Time tracking: submittedAt - startedAt stored correctly
8. Idempotent submit: same answer hash → same score, no duplicate
9. Zero-answer submission: score=0, not error
10. UserProgress updated atomically after submission

Then: SUMMARY: TOTAL, PASS, WARNINGS`
  },
  {
    id: "progress-tracking", module: "Module 4", label: "Progress · Tracking & Edge Cases",
    color: "#f59e0b", dimColor: "#f59e0b15", borderColor: "#f59e0b35", icon: "📊", layer: "Full Stack",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 4 - Progress Tracking. Be concise. Max 10 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// vitest/jest (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. Dashboard accuracy % updates after attempt (optimistic UI)
2. Weak topic list sorted ascending by accuracy
3. Empty state for student with 0 attempts
4. Score 0 and score 100 both render correctly
5. UserProgress GSI returns correct records for userId
6. Topic accuracy: correct / total per topic
7. Concurrent submissions → atomic update, no double-count
8. Abandoned attempt NOT counted in progress
9. Same worksheet attempted 5x → all 5 recorded
10. Data isolation: userId enforced, no cross-user leakage

Then: SUMMARY: TOTAL, PASS, WARNINGS, DATA_INTEGRITY_RISKS`
  },
  {
    id: "classes-rbac", module: "Module 5", label: "Classes · RBAC & Security",
    color: "#ec4899", dimColor: "#ec489915", borderColor: "#ec489935", icon: "🏫", layer: "Full Stack",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 5 - Class Management and RBAC. Be concise. Max 10 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// jest/cypress (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. Student JWT → GET /class/:id/students returns 403
2. Teacher JWT → only returns their class students
3. Parent JWT → only their linked child's data
4. Student JWT → POST /class returns 403
5. Unauthenticated → all endpoints return 401
6. Teacher creates class → unique 6+ char invite code
7. Student joins via valid code → added to roster
8. Expired code → 410 Gone with clear error
9. Student joins same class twice → idempotent
10. Teacher removes student → access revoked immediately

Then: SUMMARY: TOTAL, PASS, WARNINGS, RBAC_COVERAGE_GAPS`
  },
  {
    id: "infra-compliance", module: "Module 6", label: "Infra · CDK, CI/CD & Compliance",
    color: "#f97316", dimColor: "#f9731615", borderColor: "#f9731635", icon: "🏗️", layer: "Infrastructure",
    prompt: `${ARCHITECTURE_CONTEXT}

Test Module 6 - Infrastructure and compliance. Be concise. Max 10 test cases.

Use EXACT format:
[TEST_CASE: <name>]
STATUS: PASS | FAIL | WARNING | NEEDS_MANUAL
CODE:
\`\`\`typescript
// CDK assertions (max 15 lines)
\`\`\`
REASON: <one sentence>
EDGE_CASES: <comma separated>
[END_TEST_CASE]

Cover:
1. Each env has isolated Cognito User Pool
2. DynamoDB tables deployed with correct GSIs
3. Lambda functions have correct env vars per environment
4. S3 buckets: BlockPublicAcls=true, SSE=AES256
5. API Gateway WAF WebACL on prod only
6. Unit test failure blocks merge to main
7. Secrets never in CloudWatch logs
8. qa→prod requires manual approval
9. No PII logged in CloudWatch (COPPA)
10. DynamoDB encryption at rest on all tables

Then: SUMMARY: TOTAL, PASS, WARNINGS, COMPLIANCE_GAPS, COST_OPTIMIZATION_TIPS`
  }
];

// ─── Parser ───────────────────────────────────────────────────────────────────
function parseTestOutput(text) {
  const cases = [];
  const regex = /\[TEST_CASE:\s*(.+?)\]([\s\S]*?)\[END_TEST_CASE\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const body = match[2];
    const s = body.match(/STATUS:\s*(PASS|FAIL|WARNING|NEEDS_MANUAL)/);
    const r = body.match(/REASON:\s*(.+)/);
    const e = body.match(/EDGE_CASES:\s*(.+)/);
    const c = body.match(/CODE:\s*```(?:\w+)?\n([\s\S]*?)```/);
    cases.push({
      name: match[1].trim(),
      status: s ? s[1] : "UNKNOWN",
      reason: r ? r[1].trim() : "",
      edgeCases: e ? e[1].trim() : "",
      code: c ? c[1].trim() : ""
    });
  }
  const sm = text.match(/SUMMARY:([\s\S]*?)(?:\[TEST_CASE|$)/);
  return { cases, summary: sm ? sm[1].trim() : "" };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_META = {
  PASS:         { label: "PASS",   bg: "#052e16", border: "#166534", text: "#4ade80" },
  FAIL:         { label: "FAIL",   bg: "#450a0a", border: "#991b1b", text: "#f87171" },
  WARNING:      { label: "WARN",   bg: "#431407", border: "#9a3412", text: "#fb923c" },
  NEEDS_MANUAL: { label: "MANUAL", bg: "#1e1b4b", border: "#4338ca", text: "#a5b4fc" },
  UNKNOWN:      { label: "??",     bg: "#1c1917", border: "#44403c", text: "#a8a29e"  }
};

function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.UNKNOWN;
  return <span style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.text, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0 }}>{m.label}</span>;
}

// ─── Test Case Card ───────────────────────────────────────────────────────────
function TestCard({ tc, idx }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 7, overflow: "hidden", marginBottom: 5 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", cursor: "pointer", borderBottom: open ? "1px solid #1a1a1a" : "none" }}>
        <span style={{ color: "#2d2d2d", fontSize: 10, fontFamily: "monospace", minWidth: 20 }}>{String(idx + 1).padStart(2, "0")}</span>
        <Badge status={tc.status} />
        <span style={{ color: "#e2e8f0", fontSize: 12, flex: 1 }}>{tc.name}</span>
        <span style={{ color: "#333", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "11px 13px" }}>
          {tc.reason && <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 9, lineHeight: 1.6 }}>{tc.reason}</p>}
          {tc.edgeCases && <div style={{ marginBottom: 9 }}><span style={{ color: "#374151", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Edge cases: </span><span style={{ color: "#4b5563", fontSize: 11 }}>{tc.edgeCases}</span></div>}
          {tc.code && <pre style={{ background: "#080808", border: "1px solid #1e1e1e", borderRadius: 6, padding: "11px 13px", overflow: "auto", fontSize: 11, lineHeight: 1.7, color: "#a3e635", fontFamily: "'Fira Code',monospace", maxHeight: 280, margin: 0 }}>{tc.code}</pre>}
        </div>
      )}
    </div>
  );
}

// ─── Suite Result ─────────────────────────────────────────────────────────────
function SuiteResult({ suite, result }) {
  const counts = { PASS: 0, FAIL: 0, WARNING: 0, NEEDS_MANUAL: 0 };
  result.cases.forEach(tc => { if (counts[tc.status] !== undefined) counts[tc.status]++; });
  return (
    <div style={{ border: `1px solid ${suite.borderColor}`, borderRadius: 11, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ background: suite.dimColor, padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15 }}>{suite.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600 }}>{suite.label}</div>
          <div style={{ color: "#374151", fontSize: 10, marginTop: 1 }}>{suite.module} · {suite.layer}</div>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
          {counts.PASS > 0 && <span style={{ color: "#4ade80" }}>✓ {counts.PASS}</span>}
          {counts.FAIL > 0 && <span style={{ color: "#f87171" }}>✗ {counts.FAIL}</span>}
          {counts.WARNING > 0 && <span style={{ color: "#fb923c" }}>⚠ {counts.WARNING}</span>}
          {counts.NEEDS_MANUAL > 0 && <span style={{ color: "#a5b4fc" }}>◈ {counts.NEEDS_MANUAL}</span>}
          <span style={{ color: "#1f2937" }}>/ {result.cases.length}</span>
          {result.partial && <span style={{ color: "#fb923c", fontSize: 10 }}>partial</span>}
        </div>
      </div>
      <div style={{ padding: "11px 13px" }}>
        {result.cases.map((tc, i) => <TestCard key={i} tc={tc} idx={i} />)}
        {result.summary && (
          <div style={{ background: "#080808", border: "1px solid #111", borderRadius: 7, padding: "10px 13px", marginTop: 8 }}>
            <div style={{ color: "#1f2937", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Summary</div>
            <pre style={{ color: "#6b7280", fontSize: 11, whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "monospace", margin: 0 }}>{result.summary}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Diagnostics Bar ─────────────────────────────────────────────────────────
function DiagBar({ status, elapsed, tokens, lastTokenAge, currentSuite }) {
  const color = { idle: "#1f2937", connecting: "#f59e0b", streaming: "#4ade80", stalled: "#f87171", done: "#4ade80", error: "#f87171", timeout: "#f87171" }[status] || "#1f2937";
  const label = {
    idle: "● Idle",
    connecting: "◌ Connecting to Claude API…",
    streaming: "● Receiving tokens…",
    stalled: `⚠ No tokens for ${Math.round(lastTokenAge / 1000)}s — model may be generating a long block`,
    done: "✓ Complete",
    error: "✗ Error",
    timeout: "✗ Timed out after 90s — partial results saved if available"
  }[status] || status;

  return (
    <div style={{ background: "#080808", border: "1px solid #0d0d0d", borderRadius: 7, padding: "9px 13px", marginBottom: 12, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color, fontSize: 11, fontWeight: 600, minWidth: 320 }}>{label}</span>
      {currentSuite && <span style={{ color: "#1f2937", fontSize: 11 }}>Suite: <span style={{ color: "#374151" }}>{currentSuite}</span></span>}
      <span style={{ color: "#1f2937", fontSize: 11 }}>Elapsed: <span style={{ color: elapsed > 60 ? "#fb923c" : "#374151" }}>{elapsed}s / 90s</span></span>
      <span style={{ color: "#1f2937", fontSize: 11 }}>Tokens received: <span style={{ color: "#374151" }}>{tokens.toLocaleString()}</span></span>
      {status === "streaming" && lastTokenAge > 0 && (
        <span style={{ color: "#1f2937", fontSize: 11 }}>Last token: <span style={{ color: lastTokenAge > HEARTBEAT_WARN_MS ? "#fb923c" : "#4ade80" }}>{Math.round(lastTokenAge / 1000)}s ago</span></span>
      )}
      <div style={{ flex: 1, minWidth: 100 }}>
        <div style={{ height: 2, background: "#111", borderRadius: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min((elapsed / 90) * 100, 100)}%`, background: elapsed > 75 ? "#f87171" : elapsed > 50 ? "#fb923c" : "#4ade80", transition: "width 0.5s, background 0.5s" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Report builder ───────────────────────────────────────────────────────────
function buildReport(suites, results) {
  let tp = 0, tf = 0, tw = 0, tm = 0;
  const lines = ["# LEARNFYRA TEST REPORT", `Generated: ${new Date().toISOString()}`, "", "---", ""];
  suites.forEach(s => {
    const r = results[s.id];
    if (!r) return;
    lines.push(`## ${s.icon} ${s.label}`, "");
    r.cases.forEach((tc, i) => {
      lines.push(`### ${i + 1}. [${tc.status}] ${tc.name}`);
      if (tc.reason) lines.push(`> ${tc.reason}`);
      if (tc.edgeCases) lines.push(`**Edge cases:** ${tc.edgeCases}`);
      if (tc.code) lines.push("```typescript\n" + tc.code + "\n```");
      lines.push("");
      if (tc.status === "PASS") tp++;
      else if (tc.status === "FAIL") tf++;
      else if (tc.status === "WARNING") tw++;
      else if (tc.status === "NEEDS_MANUAL") tm++;
    });
    if (r.summary) lines.push("```\n" + r.summary + "\n```", "");
    lines.push("---", "");
  });
  const total = tp + tf + tw + tm;
  lines.unshift(`> **${total} tests** | ✓ Pass: ${tp} | ✗ Fail: ${tf} | ⚠ Warn: ${tw} | ◈ Manual: ${tm} | Coverage: ${total > 0 ? Math.round(tp / total * 100) : 0}%`, "", "---", "");
  return lines.join("\n");
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});
  const [phase, setPhase] = useState("idle");
  const [activeSuiteId, setActiveSuiteId] = useState(null);
  const [streamLog, setStreamLog] = useState("");
  const [errors, setErrors] = useState({});
  const [diag, setDiag] = useState({ status: "idle", elapsed: 0, tokens: 0, lastTokenAge: 0 });

  const abortRef   = useRef(null);
  const timerRef   = useRef(null);
  const startRef   = useRef(null);
  const lastTokRef = useRef(null);

  const startTicker = useCallback(() => {
    startRef.current   = Date.now();
    lastTokRef.current = Date.now();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      const age     = Date.now() - (lastTokRef.current || Date.now());
      setDiag(prev => ({
        ...prev,
        elapsed,
        lastTokenAge: age,
        status: age > HEARTBEAT_WARN_MS && prev.status === "streaming" ? "stalled" : prev.status
      }));
    }, 500);
  }, []);

  const stopTicker = useCallback(() => clearInterval(timerRef.current), []);
  const markToken  = useCallback(() => { lastTokRef.current = Date.now(); }, []);

  const runSuite = useCallback(async (suite) => {
    setActiveSuiteId(suite.id);
    setStreamLog("");
    setErrors(prev => { const n = { ...prev }; delete n[suite.id]; return n; });
    setDiag({ status: "connecting", elapsed: 0, tokens: 0, lastTokenAge: 0 });
    startTicker();

    const timeoutId = setTimeout(() => abortRef.current?.abort(), SUITE_TIMEOUT_MS);

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          stream: true,
          messages: [{ role: "user", content: suite.prompt }]
        }),
        signal: abortRef.current?.signal
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 180)}`);
      }

      setDiag(prev => ({ ...prev, status: "streaming" }));

      let fullText = "";
      let tokenCount = 0;
      const reader = resp.body.getReader();
      const dec = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const j = JSON.parse(line.slice(6));
            if (j.type === "content_block_delta" && j.delta?.text) {
              fullText    += j.delta.text;
              tokenCount  += j.delta.text.length;
              markToken();
              setDiag(prev => ({ ...prev, tokens: tokenCount, status: "streaming", lastTokenAge: 0 }));
              setStreamLog(fullText.slice(-1600));
            }
          } catch {}
        }
      }

      clearTimeout(timeoutId);
      stopTicker();
      const parsed = parseTestOutput(fullText);
      setResults(prev => ({ ...prev, [suite.id]: { ...parsed, rawText: fullText } }));
      setDiag(prev => ({ ...prev, status: "done" }));
      return parsed;

    } catch (err) {
      clearTimeout(timeoutId);
      stopTicker();
      const isAbort = err.name === "AbortError";
      const msg     = isAbort ? "Timed out (90s)" : err.message;
      setErrors(prev => ({ ...prev, [suite.id]: msg }));
      setDiag(prev => ({ ...prev, status: isAbort ? "timeout" : "error" }));
      // save partial if we got something
      const partial = parseTestOutput(streamLog);
      if (partial.cases.length > 0) setResults(prev => ({ ...prev, [suite.id]: { ...partial, partial: true } }));
      return null;
    }
  }, [startTicker, stopTicker, markToken, streamLog]);

  const runAll = useCallback(async () => {
    setRunning(true);
    setPhase("running");
    setResults({});
    setErrors({});

    for (const suite of TEST_SUITES) {
      abortRef.current = new AbortController();
      await runSuite(suite);
      await new Promise(r => setTimeout(r, 300));
    }

    setRunning(false);
    setPhase("done");
    setActiveSuiteId(null);
    setDiag(prev => ({ ...prev, status: "done" }));
  }, [runSuite]);

  const runOne = useCallback(async (suite) => {
    abortRef.current = new AbortController();
    setRunning(true);
    setPhase("running");
    await runSuite(suite);
    setRunning(false);
    setPhase("done");
    setActiveSuiteId(null);
  }, [runSuite]);

  const stopAll = () => {
    abortRef.current?.abort();
    stopTicker();
    setRunning(false);
    setPhase("done");
    setActiveSuiteId(null);
    setDiag(prev => ({ ...prev, status: "idle" }));
  };

  const downloadReport = () => {
    const md   = buildReport(TEST_SUITES, results);
    const blob = new Blob([md], { type: "text/markdown" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `learnfyra-tests-${Date.now()}.md`;
    a.click();
  };

  const totalCases = Object.values(results).reduce((n, r) => n + r.cases.length, 0);
  const totalPass  = Object.values(results).reduce((n, r) => n + r.cases.filter(c => c.status === "PASS").length, 0);
  const totalFail  = Object.values(results).reduce((n, r) => n + r.cases.filter(c => c.status === "FAIL").length, 0);
  const totalWarn  = Object.values(results).reduce((n, r) => n + r.cases.filter(c => c.status === "WARNING").length, 0);
  const doneCount  = Object.keys(results).length;
  const coverage   = totalCases > 0 ? Math.round(totalPass / totalCases * 100) : 0;
  const activeName = TEST_SUITES.find(s => s.id === activeSuiteId)?.label;

  return (
    <div style={{ minHeight: "100vh", background: "#030303", fontFamily: "'DM Mono','Fira Code',monospace", color: "#e2e8f0", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #0d0d0d", padding: "16px 26px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 10, color: "#1a1a1a", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 2 }}>Learnfyra · AI Test Runner</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.02em" }}>Production Test Suite</div>
          <div style={{ fontSize: 10, color: "#1a1a1a", marginTop: 2 }}>{TEST_SUITES.length} suites · Frontend · Backend · UI · Security · Infra</div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {phase === "done" && totalCases > 0 && (
            <button onClick={downloadReport} style={{ background: "#0f172a", border: "1px solid #1e293b", color: "#94a3b8", padding: "6px 13px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>↓ Export .md</button>
          )}
          {running && (
            <button onClick={stopAll} style={{ background: "#450a0a", border: "1px solid #7f1d1d", color: "#f87171", padding: "6px 13px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>■ Stop</button>
          )}
          <button onClick={runAll} disabled={running} style={{ background: running ? "#0a0a0a" : "#0f172a", border: `1px solid ${running ? "#111" : "#22d3ee"}`, color: running ? "#1f2937" : "#22d3ee", padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", letterSpacing: "0.04em" }}>
            {running ? `● Running (${doneCount}/${TEST_SUITES.length})…` : "▶ Run All Tests"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {totalCases > 0 && (
        <div style={{ background: "#080808", borderBottom: "1px solid #0d0d0d", padding: "9px 26px", display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#e2e8f0", fontSize: 11 }}><span style={{ color: "#1f2937" }}>Total: </span>{totalCases}</span>
          <span style={{ color: "#4ade80", fontSize: 11 }}>✓ {totalPass}</span>
          <span style={{ color: "#f87171", fontSize: 11 }}>✗ {totalFail}</span>
          <span style={{ color: "#fb923c", fontSize: 11 }}>⚠ {totalWarn}</span>
          <span style={{ color: "#a5b4fc", fontSize: 11 }}>◈ {totalCases - totalPass - totalFail - totalWarn}</span>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ height: 3, background: "#111", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${coverage}%`, background: "#4ade80", borderRadius: 2, transition: "width 0.5s" }} />
            </div>
            <div style={{ color: "#1f2937", fontSize: 10, marginTop: 2 }}>{coverage}% green</div>
          </div>
        </div>
      )}

      <div style={{ padding: "18px 26px" }}>

        {/* Suite grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 7, marginBottom: 18 }}>
          {TEST_SUITES.map(suite => {
            const r       = results[suite.id];
            const isActive = activeSuiteId === suite.id;
            const err     = errors[suite.id];
            const pass    = r?.cases.filter(c => c.status === "PASS").length ?? 0;
            const fail    = r?.cases.filter(c => c.status === "FAIL").length ?? 0;

            return (
              <div key={suite.id} style={{ background: isActive ? suite.dimColor : "#0a0a0a", border: `1px solid ${isActive ? suite.borderColor : err ? "#7f1d1d" : "#111"}`, borderRadius: 9, padding: "11px 13px", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                  <span style={{ fontSize: 16 }}>{suite.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3 }}>{suite.label}</div>
                    <div style={{ fontSize: 10, color: "#1a1a1a", marginTop: 1 }}>{suite.module} · {suite.layer}</div>
                  </div>
                  {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: suite.color, flexShrink: 0, marginTop: 4, animation: "pulse 1s infinite alternate", display: "inline-block" }} />}
                  {r && !isActive && !err && <span style={{ color: "#4ade80", fontSize: 10 }}>✓</span>}
                  {err && <span style={{ color: "#f87171", fontSize: 10 }}>✗</span>}
                </div>
                {r && <div style={{ display: "flex", gap: 9, fontSize: 10, marginBottom: 7 }}><span style={{ color: "#4ade80" }}>✓ {pass}</span><span style={{ color: "#f87171" }}>✗ {fail}</span><span style={{ color: "#1f2937" }}>/ {r.cases.length}</span>{r.partial && <span style={{ color: "#fb923c" }}>partial</span>}</div>}
                {err && <div style={{ color: "#f87171", fontSize: 10, marginBottom: 7, lineHeight: 1.4, wordBreak: "break-word" }}>{err}</div>}
                <button onClick={() => runOne(suite)} disabled={running} style={{ width: "100%", background: "transparent", border: `1px solid ${running ? "#111" : suite.borderColor}`, color: running ? "#1a1a1a" : suite.color, padding: "5px 0", borderRadius: 5, fontSize: 10, cursor: running ? "not-allowed" : "pointer", letterSpacing: "0.04em" }}>
                  {isActive ? "Running…" : (r || err) ? "Re-run" : "▶ Run"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Live diagnostics */}
        {(running || diag.status !== "idle") && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: "#111", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Live Diagnostics</div>
            <DiagBar status={diag.status} elapsed={diag.elapsed} tokens={diag.tokens} lastTokenAge={diag.lastTokenAge} currentSuite={activeName} />
            {streamLog && (
              <>
                <div style={{ fontSize: 10, color: "#111", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Stream Output</div>
                <pre style={{ background: "#050505", border: "1px solid #0d0d0d", borderRadius: 7, padding: "11px 13px", fontFamily: "'Fira Code',monospace", fontSize: 10, color: "#4ade80", lineHeight: 1.9, maxHeight: 190, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{streamLog}</pre>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {TEST_SUITES.filter(s => results[s.id]).map(suite => (
          <SuiteResult key={suite.id} suite={suite} result={results[suite.id]} />
        ))}

        {/* Empty state */}
        {phase === "idle" && (
          <div style={{ textAlign: "center", padding: "56px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.1 }}>◈</div>
            <div style={{ fontSize: 12, color: "#1f2937" }}>Click <span style={{ color: "#22d3ee" }}>▶ Run All Tests</span> to start the full suite</div>
            <div style={{ fontSize: 10, color: "#111", marginTop: 6 }}>9 suites · streams live · 90s timeout per suite · exports Markdown</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { from{opacity:.3} to{opacity:1} }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#080808}
        ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
        button:hover:not(:disabled){opacity:.8}
      `}</style>
    </div>
  );
}
