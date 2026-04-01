import { useState, useRef, useCallback } from "react";

/**
 * Learnfyra Integration Test Runner
 *
 * Runs REAL HTTP requests against the backend API and reports actual pass/fail.
 * No AI — every result is based on actual response status codes and JSON shapes.
 *
 * Usage: Import as a React component in a Vite dev page or render standalone.
 * Select the target environment from the dropdown before running.
 */

const ENVIRONMENTS = {
  local: { label: "Local", url: "http://localhost:3000", description: "Local Express server" },
  dev:   { label: "Dev",   url: "https://api.dev.learnfyra.com", description: "AWS dev environment" },
  qa:    { label: "QA",    url: "https://api.qa.learnfyra.com", description: "AWS QA/staging environment" },
  prod:  { label: "Prod",  url: "https://api.learnfyra.com", description: "Production (read-only tests)" },
};

// Tests that create/mutate data — skip these on prod to avoid pollution
const MUTATING_TEST_IDS = new Set([
  "auth-register", "auth-login", "auth-login-bad-password",
  "profile-patch", "profile-patch-invalid",
]);

// ─── Test definitions ────────────────────────────────────────────────────────

function makeTests(ctx, envKey) {
  const isProd = envKey === "prod";
  return [
    // ── Auth ──────────────────────────────────────────────────────────────
    {
      id: "auth-register", module: "Auth", label: "POST /api/auth/register",
      icon: "🔐", layer: "API",
      run: async () => {
        const email = `test-runner-${Date.now()}@test.com`;
        ctx.testEmail = email;
        const res = await api("POST", "/api/auth/register", {
          email, password: "TestPass123!", role: "student", displayName: "Runner User",
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.token, "Missing token in response");
        assert(res.body.userId, "Missing userId in response");
        ctx.testToken = res.body.token;
        return "Registered user and received token";
      },
    },
    {
      id: "auth-login", module: "Auth", label: "POST /api/auth/login",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/login", {
          email: ctx.testEmail, password: "TestPass123!",
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.token, "Missing token");
        assert(res.body.email === ctx.testEmail, "Email mismatch");
        return "Login returned valid token";
      },
    },
    {
      id: "auth-login-bad-password", module: "Auth", label: "POST /api/auth/login (wrong password)",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/login", {
          email: ctx.testEmail, password: "WrongPassword!",
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        return "Rejected wrong password with 401";
      },
    },
    {
      id: "auth-oauth-google", module: "Auth", label: "POST /api/auth/oauth/google",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/oauth/google", {});
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.authorizationUrl, "Missing authorizationUrl");
        assert(res.body.authorizationUrl.includes("accounts.google.com"), "URL not Google");
        return "Returns valid Google authorization URL";
      },
    },
    {
      id: "auth-callback-no-code", module: "Auth", label: "GET /api/auth/callback/google (no code)",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await rawFetch("GET", "/api/auth/callback/google", null, { redirect: "manual" });
        assert(res.status === 302, `Expected 302 redirect, got ${res.status}`);
        const location = res.headers.get("location") || "";
        assert(location.includes("authError"), "Redirect should contain authError param");
        return "Redirects with error when no code provided";
      },
    },
    {
      id: "auth-logout", module: "Auth", label: "POST /api/auth/logout",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/logout", {}, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        return "Logout returns 200";
      },
    },
    {
      id: "auth-refresh-route", module: "Auth", label: "POST /api/auth/refresh (route exists)",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/refresh", {});
        // Should not be 404 (route exists), 400 or 401 is expected without valid refresh token
        assert(res.status !== 404, `Route not found (404) — refresh route missing from server.js`);
        return `Route exists, returns ${res.status} without valid refresh token`;
      },
    },
    {
      id: "auth-forgot-password", module: "Auth", label: "POST /api/auth/forgot-password",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/forgot-password", { email: "test@example.com" });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        return "Always returns 200 (no email enumeration)";
      },
    },
    {
      id: "auth-reset-password", module: "Auth", label: "POST /api/auth/reset-password (invalid token)",
      icon: "🔐", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/auth/reset-password", {
          token: "dummy", newPassword: "NewPass123!",
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Rejects invalid reset token with 400";
      },
    },

    // ── Student / Profile ─────────────────────────────────────────────────
    {
      id: "profile-get", module: "Profile", label: "GET /api/student/profile",
      icon: "👤", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/student/profile", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.userId, "Missing userId");
        assert(res.body.email, "Missing email");
        assert(res.body.displayName, "Missing displayName");
        assert("grade" in res.body, "Missing grade field");
        assert("authType" in res.body, "Missing authType field");
        return "Profile returns userId, email, displayName, grade, authType";
      },
    },
    {
      id: "profile-patch", module: "Profile", label: "PATCH /api/student/profile (update grade)",
      icon: "👤", layer: "API",
      run: async () => {
        const res = await api("PATCH", "/api/student/profile", { grade: 8 }, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        // Verify it persisted
        const check = await api("GET", "/api/student/profile", null, ctx.testToken);
        assert(check.body.grade === 8, `Grade not persisted: expected 8, got ${check.body.grade}`);
        return "Grade updated and persisted in DB";
      },
    },
    {
      id: "profile-patch-invalid", module: "Profile", label: "PATCH /api/student/profile (invalid grade)",
      icon: "👤", layer: "API",
      run: async () => {
        const res = await api("PATCH", "/api/student/profile", { grade: 0 }, ctx.testToken);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Rejects grade=0 with 400";
      },
    },
    {
      id: "profile-no-auth", module: "Profile", label: "PATCH /api/student/profile (no token)",
      icon: "👤", layer: "API",
      run: async () => {
        const res = await api("PATCH", "/api/student/profile", { grade: 5 });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        return "Returns 401 without auth token";
      },
    },
    {
      id: "join-class-no-code", module: "Profile", label: "POST /api/student/join-class (no code)",
      icon: "👤", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/student/join-class", {}, ctx.testToken);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Validates missing invite code";
      },
    },

    // ── Dashboard ─────────────────────────────────────────────────────────
    {
      id: "dashboard-stats", module: "Dashboard", label: "GET /api/dashboard/stats",
      icon: "📊", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/dashboard/stats", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert("worksheetsDone" in res.body, "Missing worksheetsDone");
        assert("bestScore" in res.body, "Missing bestScore");
        return "Returns dashboard stats";
      },
    },
    {
      id: "dashboard-recent", module: "Dashboard", label: "GET /api/dashboard/recent-worksheets",
      icon: "📊", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/dashboard/recent-worksheets", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body), "Expected array response");
        return "Returns recent worksheets array";
      },
    },
    {
      id: "dashboard-subject", module: "Dashboard", label: "GET /api/dashboard/subject-progress",
      icon: "📊", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/dashboard/subject-progress", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body), "Expected array response");
        return "Returns subject progress array";
      },
    },

    // ── Progress ──────────────────────────────────────────────────────────
    {
      id: "progress-history", module: "Progress", label: "GET /api/progress/history",
      icon: "📈", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/progress/history", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.attempts !== undefined, "Missing attempts field");
        return "Returns progress history";
      },
    },
    {
      id: "progress-insights", module: "Progress", label: "GET /api/progress/insights",
      icon: "📈", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/progress/insights", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert("insights" in res.body, "Missing insights field");
        return "Returns progress insights";
      },
    },

    // ── Certificates ──────────────────────────────────────────────────────
    {
      id: "certificates-list", module: "Certificates", label: "GET /api/certificates",
      icon: "🏆", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/certificates", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert("certificates" in res.body, "Missing certificates field");
        return "Returns certificates list";
      },
    },

    // ── Rewards ───────────────────────────────────────────────────────────
    {
      id: "rewards-student", module: "Rewards", label: "GET /api/rewards/student/:id",
      icon: "🎁", layer: "API",
      run: async () => {
        const profile = await api("GET", "/api/student/profile", null, ctx.testToken);
        const res = await api("GET", `/api/rewards/student/${profile.body.userId}`, null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert("lifetimePoints" in res.body, "Missing lifetimePoints");
        assert("badges" in res.body, "Missing badges");
        return "Returns reward profile with points and badges";
      },
    },

    // ── Class ─────────────────────────────────────────────────────────────
    {
      id: "class-create-student-forbidden", module: "Class", label: "POST /api/class/create (student = 403)",
      icon: "🏫", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/class/create", {
          className: "Test", grade: 5, subject: "Math",
        }, ctx.testToken);
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        return "Students cannot create classes";
      },
    },

    // ── Generate (validation only) ────────────────────────────────────────
    {
      id: "generate-validation", module: "Generate", label: "POST /api/generate (empty body)",
      icon: "⚡", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/generate", {});
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Validates input and rejects empty body";
      },
    },

    // ── Solve / Submit ────────────────────────────────────────────────────
    {
      id: "solve-invalid-id", module: "Solve", label: "GET /api/solve/:id (invalid ID)",
      icon: "📝", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/solve/not-a-uuid");
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Rejects invalid worksheet ID";
      },
    },
    {
      id: "submit-invalid", module: "Solve", label: "POST /api/submit (invalid body)",
      icon: "📝", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/submit", { worksheetId: "bad", answers: [] });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Validates submit request";
      },
    },

    // ── Admin ─────────────────────────────────────────────────────────────
    {
      id: "admin-policies", module: "Admin", label: "GET /api/admin/policies",
      icon: "🛡️", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/admin/policies", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert("modelRouting" in res.body, "Missing modelRouting");
        return "Returns admin policies";
      },
    },
    {
      id: "admin-audit", module: "Admin", label: "GET /api/admin/audit/events",
      icon: "🛡️", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/admin/audit/events", null, ctx.testToken);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert("events" in res.body, "Missing events field");
        return "Returns audit events";
      },
    },

    // ── CORS ──────────────────────────────────────────────────────────────
    {
      id: "cors-preflight", module: "CORS", label: "OPTIONS /api/student/profile",
      icon: "🌐", layer: "Infra",
      run: async () => {
        const res = await rawFetch("OPTIONS", "/api/student/profile", null, {
          headers: {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "Content-Type,Authorization",
          },
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const allow = res.headers.get("access-control-allow-methods") || "";
        assert(allow.includes("PATCH"), `PATCH not in allowed methods: ${allow}`);
        return "CORS preflight allows PATCH";
      },
    },
    {
      id: "cors-response-headers", module: "CORS", label: "GET /api/dashboard/stats (CORS headers)",
      icon: "🌐", layer: "Infra",
      run: async () => {
        const res = await rawFetch("GET", "/api/dashboard/stats", null, {
          headers: {
            "Origin": "http://localhost:5173",
            "Authorization": `Bearer ${ctx.testToken}`,
          },
        });
        const origin = res.headers.get("access-control-allow-origin");
        assert(origin, "Missing Access-Control-Allow-Origin header");
        return `CORS header present: ${origin}`;
      },
    },
  ];
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

// apiBase is set per-run from the selected environment
let _apiBase = ENVIRONMENTS.local.url;

function setApiBase(url) { _apiBase = url; }

async function rawFetch(method, path, body, opts = {}) {
  const url = `${_apiBase}${path}`;
  const headers = { ...(opts.headers || {}) };
  if (body && method !== "GET") headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: opts.redirect || "follow",
  });
  return res;
}

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${_apiBase}${path}`;
  const opts = { method, headers };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {}
  return { status: res.status, body: parsed, headers: res.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Status colors ───────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PASS:    { bg: "#052e16", border: "#166534", text: "#4ade80", label: "PASS" },
  FAIL:    { bg: "#450a0a", border: "#991b1b", text: "#f87171", label: "FAIL" },
  SKIPPED: { bg: "#1c1917", border: "#44403c", text: "#fbbf24", label: "SKIP" },
  RUNNING: { bg: "#1e1b4b", border: "#4338ca", text: "#a5b4fc", label: "..." },
  PENDING: { bg: "#1c1917", border: "#44403c", text: "#a8a29e", label: "—" },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      padding: "2px 7px", borderRadius: 4, fontFamily: "monospace", flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

// ─── Test row ────────────────────────────────────────────────────────────────

function TestRow({ test, result, idx }) {
  const [open, setOpen] = useState(false);
  const status = result?.status || "PENDING";
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 7, overflow: "hidden", marginBottom: 4 }}>
      <div
        onClick={() => result && setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", cursor: result ? "pointer" : "default" }}
      >
        <span style={{ color: "#2d2d2d", fontSize: 10, fontFamily: "monospace", minWidth: 22 }}>
          {String(idx + 1).padStart(2, "0")}
        </span>
        <Badge status={status} />
        <span style={{ color: "#e2e8f0", fontSize: 12, flex: 1 }}>{test.label}</span>
        <span style={{ color: "#374151", fontSize: 10 }}>{test.module}</span>
        {result && <span style={{ color: "#333", fontSize: 10 }}>{open ? "▲" : "▼"}</span>}
      </div>
      {open && result && (
        <div style={{ padding: "8px 13px", borderTop: "1px solid #1a1a1a" }}>
          {result.message && (
            <p style={{ color: status === "FAIL" ? "#f87171" : "#94a3b8", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
              {result.message}
            </p>
          )}
          {result.error && (
            <pre style={{
              background: "#0a0000", border: "1px solid #2a0000", borderRadius: 5,
              padding: "8px 12px", color: "#f87171", fontSize: 11, fontFamily: "monospace",
              whiteSpace: "pre-wrap", marginTop: 6, marginBottom: 0,
            }}>
              {result.error}
            </pre>
          )}
          {result.duration && (
            <span style={{ color: "#374151", fontSize: 10, marginTop: 4, display: "block" }}>
              {result.duration}ms
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [envKey, setEnvKey] = useState("local");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});
  const [counts, setCounts] = useState({ total: 0, pass: 0, fail: 0, done: 0, skipped: 0 });
  const ctxRef = useRef({});

  const env = ENVIRONMENTS[envKey];
  const isProd = envKey === "prod";

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults({});
    ctxRef.current = {};
    setApiBase(ENVIRONMENTS[envKey].url);

    const allTests = makeTests(ctxRef.current, envKey);
    // On prod, skip mutating tests to avoid data pollution
    const tests = allTests.filter(t => !(isProd && MUTATING_TEST_IDS.has(t.id)));
    const skipped = allTests.length - tests.length;

    setCounts({ total: tests.length, pass: 0, fail: 0, done: 0, skipped });

    // Mark skipped tests
    if (skipped > 0) {
      allTests.forEach(t => {
        if (MUTATING_TEST_IDS.has(t.id) && isProd) {
          setResults(prev => ({ ...prev, [t.id]: { status: "SKIPPED", message: "Skipped on prod (mutating test)" } }));
        }
      });
    }

    let pass = 0, fail = 0;

    for (const test of tests) {
      setResults(prev => ({ ...prev, [test.id]: { status: "RUNNING" } }));

      const start = performance.now();
      try {
        const message = await test.run();
        const duration = Math.round(performance.now() - start);
        pass++;
        setResults(prev => ({ ...prev, [test.id]: { status: "PASS", message, duration } }));
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        fail++;
        setResults(prev => ({
          ...prev,
          [test.id]: { status: "FAIL", error: err.message, duration },
        }));
      }

      setCounts({ total: tests.length, pass, fail, done: pass + fail, skipped });
    }

    setRunning(false);
  }, [envKey, isProd]);

  const allTests = makeTests(ctxRef.current, envKey);
  const pct = counts.total > 0 ? Math.round((counts.pass / counts.total) * 100) : 0;

  return (
    <div style={{
      minHeight: "100vh", background: "#000", color: "#e2e8f0",
      fontFamily: "'Inter', -apple-system, sans-serif", padding: "24px 20px",
      maxWidth: 720, margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>
          Learnfyra Integration Tests
        </h1>
        <p style={{ fontSize: 12, color: "#374151", margin: "4px 0 0" }}>
          Real HTTP requests — no AI, no mocks
        </p>
      </div>

      {/* Environment selector */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap",
      }}>
        {Object.entries(ENVIRONMENTS).map(([key, e]) => (
          <button
            key={key}
            disabled={running}
            onClick={() => { setEnvKey(key); setResults({}); setCounts({ total: 0, pass: 0, fail: 0, done: 0, skipped: 0 }); }}
            style={{
              background: envKey === key ? "#166534" : "#111",
              color: envKey === key ? "#4ade80" : "#666",
              border: `1px solid ${envKey === key ? "#166534" : "#222"}`,
              borderRadius: 6, padding: "6px 14px",
              fontSize: 12, fontWeight: 600, cursor: running ? "default" : "pointer",
              opacity: running ? 0.5 : 1,
            }}
          >
            {e.label}
          </button>
        ))}
        <span style={{ color: "#374151", fontSize: 11, alignSelf: "center", marginLeft: 6 }}>
          {env.url}
        </span>
        {isProd && (
          <span style={{ color: "#fbbf24", fontSize: 10, alignSelf: "center", fontWeight: 600 }}>
            (read-only — mutating tests skipped)
          </span>
        )}
      </div>

      {/* Stats bar */}
      <div style={{
        display: "flex", gap: 16, alignItems: "center", marginBottom: 16,
        background: "#080808", border: "1px solid #111", borderRadius: 8, padding: "10px 16px",
      }}>
        <button
          onClick={runAll}
          disabled={running}
          style={{
            background: running ? "#1a1a1a" : "#166534",
            color: running ? "#666" : "#4ade80",
            border: "none", borderRadius: 6, padding: "7px 18px",
            fontSize: 12, fontWeight: 700, cursor: running ? "default" : "pointer",
          }}
        >
          {running ? `Running ${counts.done}/${counts.total}...` : "Run All Tests"}
        </button>

        {counts.total > 0 && (
          <>
            <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>
              {counts.pass} pass
            </span>
            <span style={{ color: counts.fail > 0 ? "#f87171" : "#374151", fontSize: 12, fontWeight: 600 }}>
              {counts.fail} fail
            </span>
            {counts.skipped > 0 && (
              <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600 }}>
                {counts.skipped} skipped
              </span>
            )}
            <span style={{ color: "#374151", fontSize: 12 }}>
              {counts.done}/{counts.total}
            </span>
            <div style={{ flex: 1, height: 4, background: "#111", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(counts.done / counts.total) * 100}%`,
                background: counts.fail > 0 ? "#f87171" : "#4ade80",
                transition: "width 0.3s",
              }} />
            </div>
            <span style={{
              color: counts.fail > 0 ? "#f87171" : "#4ade80",
              fontSize: 14, fontWeight: 700, fontFamily: "monospace",
            }}>
              {pct}%
            </span>
          </>
        )}
      </div>

      {/* Test list */}
      <div>
        {allTests.map((test, i) => (
          <TestRow key={test.id} test={test} result={results[test.id]} idx={i} />
        ))}
      </div>

      {/* Footer */}
      {counts.done === counts.total && counts.total > 0 && !running && (
        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: counts.fail === 0 ? "#052e16" : "#450a0a",
          border: `1px solid ${counts.fail === 0 ? "#166534" : "#991b1b"}`,
          textAlign: "center",
        }}>
          <span style={{
            color: counts.fail === 0 ? "#4ade80" : "#f87171",
            fontSize: 13, fontWeight: 700,
          }}>
            {counts.fail === 0
              ? `All ${counts.total} tests passed${counts.skipped ? ` (${counts.skipped} skipped)` : ""}`
              : `${counts.fail} of ${counts.total} tests failed${counts.skipped ? ` (${counts.skipped} skipped)` : ""}`}
          </span>
        </div>
      )}
    </div>
  );
}
