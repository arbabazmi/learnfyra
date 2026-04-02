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
        const url = res.body.authorizationUrl;
        const isGoogle = url.includes("accounts.google.com");
        const isCognito = url.includes("amazoncognito.com") && url.includes("identity_provider=Google");
        assert(isGoogle || isCognito, `URL is neither Google nor Cognito: ${url.slice(0, 80)}...`);
        return isCognito ? "Returns Cognito-hosted Google OAuth URL" : "Returns direct Google authorization URL";
      },
    },
    {
      id: "auth-callback-no-code", module: "Auth", label: "GET /api/auth/callback/google (no code)",
      icon: "🔐", layer: "API",
      run: async () => {
        // Cross-origin redirect from :3000 → :5173 causes "Failed to fetch" in browsers.
        // Use the Vite proxy (same-origin /api) to avoid the CORS redirect issue.
        const proxyRes = await fetch("/api/auth/callback/google", { redirect: "manual" });
        // Vite proxy forwards the 302 — opaqueredirect type means redirect was received
        assert(
          proxyRes.type === "opaqueredirect" || proxyRes.status === 302 || proxyRes.status === 0,
          `Expected redirect, got status ${proxyRes.status} type ${proxyRes.type}`
        );
        return "Callback without code returns redirect";
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
        const res = await api("POST", "/api/generate", {}, ctx.testToken);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Validates input and rejects empty body";
      },
    },

    // ── Solve / Submit ────────────────────────────────────────────────────
    {
      id: "solve-invalid-id", module: "Solve", label: "GET /api/solve/:id (invalid ID)",
      icon: "📝", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/solve/not-a-uuid", null, ctx.testToken);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Rejects invalid worksheet ID";
      },
    },
    {
      id: "submit-invalid", module: "Solve", label: "POST /api/submit (invalid body)",
      icon: "📝", layer: "API",
      run: async () => {
        const res = await api("POST", "/api/submit", { worksheetId: "bad", answers: [] }, ctx.testToken);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        return "Validates submit request";
      },
    },

    // ── Admin (student should be forbidden) ─────────────────────────────
    {
      id: "admin-policies-forbidden", module: "Admin", label: "GET /api/admin/policies (student = 403)",
      icon: "🛡️", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/admin/policies", null, ctx.testToken);
        assert(res.status === 403, `Expected 403 for student, got ${res.status}`);
        return "Students cannot access admin policies";
      },
    },
    {
      id: "admin-audit-forbidden", module: "Admin", label: "GET /api/admin/audit/events (student = 403)",
      icon: "🛡️", layer: "API",
      run: async () => {
        const res = await api("GET", "/api/admin/audit/events", null, ctx.testToken);
        assert(res.status === 403, `Expected 403 for student, got ${res.status}`);
        return "Students cannot access audit events";
      },
    },

    // ── CORS ──────────────────────────────────────────────────────────────
    // Note: Browser-based fetch can't inspect CORS preflight directly.
    // We test that cross-origin requests succeed (which proves CORS works).
    {
      id: "cors-cross-origin", module: "CORS", label: "Cross-origin GET /api/dashboard/stats",
      icon: "🌐", layer: "Infra",
      run: async () => {
        // This fetch goes cross-origin (localhost:5173 → localhost:3000).
        // If CORS headers are missing, the browser will block it and fetch throws.
        const res = await api("GET", "/api/dashboard/stats", null, ctx.testToken);
        assert(res.status === 200, `Cross-origin request failed with status ${res.status}`);
        return "Cross-origin request succeeds (CORS working)";
      },
    },
    {
      id: "cors-cross-origin-patch", module: "CORS", label: "Cross-origin PATCH /api/student/profile",
      icon: "🌐", layer: "Infra",
      run: async () => {
        // PATCH requires preflight. If OPTIONS doesn't return PATCH in allowed methods, this fails.
        const res = await api("PATCH", "/api/student/profile", { displayName: "CORS Test" }, ctx.testToken);
        assert(res.status === 200, `Cross-origin PATCH failed with status ${res.status}`);
        return "Cross-origin PATCH succeeds (preflight + CORS working)";
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

let api = async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${_apiBase}${path}`;
  const opts = { method, headers };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (fetchErr) {
    // Network-level failure (CORS blocked, DNS, etc.)
    return {
      status: 0,
      body: { error: `Network error: ${fetchErr.message}` },
      headers: new Headers(),
      _fetchError: fetchErr.message,
    };
  }
  let parsed = {};
  let rawText = "";
  try {
    rawText = await res.text();
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { _rawBody: rawText || "(empty)" };
  }
  return { status: res.status, body: parsed, headers: res.headers };
};

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
          {/* API response details for failed tests */}
          {status === "FAIL" && (result.apiError || result.fetchError || result.apiDebug) && (
            <div style={{
              background: "#0a0a14", border: "1px solid #1a1a3a", borderRadius: 5,
              padding: "8px 12px", marginTop: 6,
            }}>
              <span style={{ color: "#6366f1", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>
                API RESPONSE
              </span>
              {result.apiStatus != null && (
                <span style={{ color: "#4b5563", fontSize: 10, marginLeft: 8 }}>
                  HTTP {result.apiStatus}
                </span>
              )}
              {result.fetchError && (
                <p style={{ color: "#fb923c", fontSize: 11, margin: "4px 0 0", fontFamily: "monospace" }}>
                  Fetch error: {result.fetchError}
                </p>
              )}
              {result.apiError && (
                <p style={{ color: "#f9a8d4", fontSize: 11, margin: "4px 0 0", fontFamily: "monospace" }}>
                  {result.apiError}
                </p>
              )}
              {result.apiDebug && (
                <pre style={{
                  color: "#94a3b8", fontSize: 10, fontFamily: "monospace",
                  whiteSpace: "pre-wrap", margin: "6px 0 0", lineHeight: 1.5,
                }}>
{`handler: ${result.apiDebug.handler || "—"}
status:  ${result.apiDebug.statusCode || "—"}
time:    ${result.apiDebug.timestamp || "—"}
stack:   ${result.apiDebug.stack || "—"}`}
                </pre>
              )}
            </div>
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

// ─── Report builder ─────────────────────────────────────────────────────────

function buildReport(tests, results, env, counts, authUser) {
  const ts = new Date().toISOString();
  const lines = [
    `LEARNFYRA INTEGRATION TEST REPORT`,
    `==================================`,
    `Environment: ${env.label} (${env.url})`,
    `Timestamp:   ${ts}`,
    ...(authUser && !authUser.error ? [`Test User:   ${authUser.email} (${authUser.role})`] : [`Test User:   auto-registered`]),
    `Results:     ${counts.pass} pass / ${counts.fail} fail${counts.skipped ? ` / ${counts.skipped} skipped` : ""} (${counts.total} total)`,
    ``,
    `| # | Test | Status | Duration | Details |`,
    `|---|------|--------|----------|---------|`,
  ];

  tests.forEach((t, i) => {
    const r = results[t.id];
    if (!r) return;
    const status = r.status || "PENDING";
    const dur = r.duration != null ? `${r.duration}ms` : "—";
    const detail = r.error || r.message || "";
    lines.push(`| ${String(i + 1).padStart(2)} | ${t.label} | ${status} | ${dur} | ${detail} |`);
  });

  lines.push(``);

  // Failures section
  const failures = tests.filter(t => results[t.id]?.status === "FAIL");
  if (failures.length > 0) {
    lines.push(`FAILURES (${failures.length}):`, ``);
    failures.forEach(t => {
      const r = results[t.id];
      lines.push(`  ${t.label}`);
      lines.push(`    Error: ${r.error}`);
      if (r.apiStatus != null) lines.push(`    HTTP Status: ${r.apiStatus}`);
      if (r.fetchError) lines.push(`    Fetch Error: ${r.fetchError}`);
      if (r.apiError) lines.push(`    API Error: ${r.apiError}`);
      if (r.apiDebug) {
        lines.push(`    Debug: handler=${r.apiDebug.handler || "?"}, status=${r.apiDebug.statusCode || "?"}`);
        if (r.apiDebug.stack) lines.push(`    Stack: ${r.apiDebug.stack.split("\n").slice(0, 3).join(" | ")}`);
      }
      lines.push(``);
    });
  }

  return lines.join("\n");
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [envKey, setEnvKey] = useState("local");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});
  const [counts, setCounts] = useState({ total: 0, pass: 0, fail: 0, done: 0, skipped: 0 });
  const [copied, setCopied] = useState(false);
  const [creds, setCreds] = useState({ email: "", password: "" });
  const [authUser, setAuthUser] = useState(null); // { email, role, userId, mode }
  const ctxRef = useRef({});

  const env = ENVIRONMENTS[envKey];
  const isProd = envKey === "prod";
  const useExistingUser = creds.email.trim() && creds.password.trim();

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults({});
    setAuthUser(null);
    ctxRef.current = {};
    setApiBase(ENVIRONMENTS[envKey].url);

    // If credentials provided, login first and pre-fill ctx with token
    const _useExisting = creds.email.trim() && creds.password.trim();
    if (_useExisting) {
      try {
        const loginRes = await api("POST", "/api/auth/login", {
          email: creds.email.trim(), password: creds.password.trim(),
        });
        if (loginRes.status !== 200 || !loginRes.body.token) {
          const errMsg = loginRes.body?.error || `Login failed with status ${loginRes.status}`;
          setAuthUser({ error: errMsg });
          setRunning(false);
          return;
        }
        ctxRef.current.testToken = loginRes.body.token;
        ctxRef.current.testEmail = loginRes.body.email;
        setAuthUser({
          email: loginRes.body.email,
          role: loginRes.body.role,
          userId: loginRes.body.userId,
          displayName: loginRes.body.displayName,
          mode: "credentials",
        });
      } catch (err) {
        setAuthUser({ error: `Login error: ${err.message}` });
        setRunning(false);
        return;
      }
    }

    const allTests = makeTests(ctxRef.current, envKey);
    // On prod, skip mutating tests to avoid data pollution
    // If using existing user, also skip register test (already logged in)
    const skipIds = new Set(isProd ? MUTATING_TEST_IDS : []);
    if (_useExisting) {
      skipIds.add("auth-register");
      skipIds.add("auth-login");
      skipIds.add("auth-login-bad-password");
    }
    const tests = allTests.filter(t => !skipIds.has(t.id));
    const skipped = allTests.length - tests.length;

    setCounts({ total: tests.length, pass: 0, fail: 0, done: 0, skipped });

    // Mark skipped tests
    if (skipped > 0) {
      allTests.forEach(t => {
        if (skipIds.has(t.id)) {
          const reason = _useExisting ? "Skipped (using provided credentials)" : "Skipped on prod (mutating test)";
          setResults(prev => ({ ...prev, [t.id]: { status: "SKIPPED", message: reason } }));
        }
      });
    }

    let pass = 0, fail = 0;

    // Track last API response per-test for debug info on failure
    let _lastApiRes = null;
    const _origApiFn = api;
    // Monkey-patch to capture last response (restored after loop)
    const _patchedApi = async (...args) => {
      const res = await _origApiFn(...args);
      _lastApiRes = res;
      return res;
    };
    // eslint-disable-next-line no-func-assign
    api = _patchedApi;

    for (const test of tests) {
      setResults(prev => ({ ...prev, [test.id]: { status: "RUNNING" } }));
      _lastApiRes = null;

      const start = performance.now();
      try {
        const message = await test.run();
        const duration = Math.round(performance.now() - start);
        pass++;
        setResults(prev => ({ ...prev, [test.id]: { status: "PASS", message, duration } }));
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        fail++;
        // Capture the last API response for debug context
        const lastRes = _lastApiRes;
        const apiError = lastRes?.body?.error || "";
        const apiDebug = lastRes?.body?._debug || null;
        const apiStatus = lastRes?.status;
        const fetchError = lastRes?._fetchError || "";
        setResults(prev => ({
          ...prev,
          [test.id]: {
            status: "FAIL", error: err.message, duration,
            apiStatus, apiError, apiDebug, fetchError,
          },
        }));
      }

      setCounts({ total: tests.length, pass, fail, done: pass + fail, skipped });
    }

    // Restore original api function
    // eslint-disable-next-line no-func-assign
    api = _origApiFn;
    setRunning(false);
  }, [envKey, isProd, creds]);

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

      {/* Credentials (optional — use existing user instead of auto-register) */}
      <div style={{
        marginBottom: 12, padding: "10px 14px",
        background: "#080808", border: `1px solid ${useExistingUser ? "#166534" : "#1a1a1a"}`,
        borderRadius: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600 }}>
            Test as existing user (optional)
          </span>
          {useExistingUser && (
            <span style={{ color: "#4ade80", fontSize: 10, fontWeight: 600 }}>
              Will login with these credentials
            </span>
          )}
          {!useExistingUser && (
            <span style={{ color: "#374151", fontSize: 10 }}>
              Leave empty to auto-register a new test user
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="Email"
            value={creds.email}
            onChange={e => setCreds(c => ({ ...c, email: e.target.value }))}
            disabled={running}
            style={{
              flex: 1, minWidth: 200, padding: "6px 10px",
              background: "#111", border: "1px solid #222", borderRadius: 5,
              color: "#e2e8f0", fontSize: 12, fontFamily: "monospace",
              outline: "none",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={creds.password}
            onChange={e => setCreds(c => ({ ...c, password: e.target.value }))}
            disabled={running}
            style={{
              flex: 1, minWidth: 180, padding: "6px 10px",
              background: "#111", border: "1px solid #222", borderRadius: 5,
              color: "#e2e8f0", fontSize: 12, fontFamily: "monospace",
              outline: "none",
            }}
          />
          {useExistingUser && (
            <button
              onClick={() => setCreds({ email: "", password: "" })}
              disabled={running}
              style={{
                padding: "6px 12px", background: "#1a1a1a", color: "#a8a29e",
                border: "1px solid #333", borderRadius: 5, fontSize: 11,
                cursor: running ? "default" : "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
        {authUser && !authUser.error && (
          <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#4ade80", fontSize: 11 }}>
              Logged in as {authUser.email}
            </span>
            <span style={{
              background: "#052e16", border: "1px solid #166534", color: "#4ade80",
              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
            }}>
              {authUser.role}
            </span>
            <span style={{ color: "#374151", fontSize: 10 }}>
              {authUser.userId}
            </span>
          </div>
        )}
        {authUser?.error && (
          <div style={{ marginTop: 8 }}>
            <span style={{ color: "#f87171", fontSize: 11 }}>
              {authUser.error}
            </span>
          </div>
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

      {/* Footer + Copy Report */}
      {counts.done === counts.total && counts.total > 0 && !running && (
        <>
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

          <button
            onClick={() => {
              const report = buildReport(allTests, results, env, counts, authUser);
              navigator.clipboard.writeText(report).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            style={{
              marginTop: 10, width: "100%", padding: "10px 16px",
              background: copied ? "#166534" : "#1a1a1a",
              color: copied ? "#4ade80" : "#a8a29e",
              border: `1px solid ${copied ? "#166534" : "#333"}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {copied ? "Copied to clipboard!" : "Copy Full Report"}
          </button>

          {/* Inline report preview */}
          <pre style={{
            marginTop: 10, padding: "14px 16px", borderRadius: 8,
            background: "#080808", border: "1px solid #1a1a1a",
            color: "#94a3b8", fontSize: 11, fontFamily: "'Fira Code', monospace",
            whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 400, overflow: "auto",
          }}>
            {buildReport(allTests, results, env, counts, authUser)}
          </pre>
        </>
      )}
    </div>
  );
}
