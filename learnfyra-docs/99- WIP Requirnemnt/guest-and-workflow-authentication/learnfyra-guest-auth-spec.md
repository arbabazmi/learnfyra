# Learnfyra — Guest Authentication & Authorization
## Canonical Feature Specification v1.0
> Status: APPROVED FOR IMPLEMENTATION  
> Scope: Module 1 extension — Guest token issuance, role-based guest access, GuestSessions table, fixture Lambda  
> Environments: dev → qa → prod  
> Last updated: 2026-04-02

---

## 1. Background & Motivation

Learnfyra's core philosophy: **no flow is gated behind registration**. Authentication is optional and framed as a benefit, never a requirement. This spec defines the technical design for guest users who arrive without a Cognito JWT — they receive a backend-issued guest token, can access role-appropriate functionality with soft nudges to register, and transition seamlessly to authenticated state when they choose to log in.

---

## 2. Finalized Decision Log

| # | Topic | Decision |
|---|---|---|
| 1 | Guest token type | **Option B — Backend-issued JWT** signed by a dedicated guest Lambda, carrying `role: guest-student | guest-teacher | guest-parent` and a `guestId` |
| 2 | Worksheet count enforcement | **Server-side only** — tracked in `GuestSessions` DynamoDB table. Client cookie holds `guestId` as identifier only, never the counter |
| 3 | Guest AI generation policy | **Allowed** — counts against the 10-worksheet limit, aggressively rate-limited at API Gateway |
| 4 | Bank miss behaviour | Generate via Bedrock, consume 1 worksheet slot, show "Login for unlimited access" nudge |
| 5 | guestId merge on login | **No DynamoDB migration** — guest attempt data expires via TTL. Frontend saves pre-login URL in `sessionStorage`, post-callback redirects user back. Authenticated user gets a clean `Users` record |
| 6 | Guest token issuance trigger | On **"Continue as Guest"** click in the role-picker modal. NOT on page load |
| 7 | Guest token endpoint security | **IP-based throttling** via API Gateway usage plan (MVP). No CAPTCHA for now |
| 8 | Guest JWT TTL | **30 days** |
| 9 | Worksheet limit unit | **10 unique worksheets** — re-solving or re-downloading the same worksheet does NOT consume an additional slot |
| 10 | Guest Teacher/Parent data | **Single fixture Lambda** `GET /guest/preview?role=teacher\|parent` returning hardcoded JSON — no DynamoDB reads |
| 11 | Guest DynamoDB storage | **`GuestSessions` table only** — no `Users` table record for guests |
| 12 | Deep link with no token | **Role-picker modal auto-shown on arrival** at any non-landing page when no token is present |
| 13 | Role declaration | Role picked inside the arrival modal before token issuance |
| 14 | Counter increment timing | At **`POST /worksheet` intake** — not at COMPLETED. Bad input (400) does not consume a slot |
| 15 | Guest JWT storage (frontend) | **JS-readable cookie**: `SameSite=Strict; Secure; Max-Age=2592000; Path=/` — NOT `httpOnly`. Frontend reads it to construct `Authorization: Bearer` header |
| 16 | Cookie cleared = fresh allowance | Conscious acceptable tradeoff for a free platform. No action required |

---

## 3. User Flow

### 3.1 Authenticated User (happy path — unchanged)
```
Landing page / any deep link
  → Has valid Cognito JWT in cookie
  → Full access per role (student / teacher / parent)
  → No modal, no nudge
```

### 3.2 Guest User — First Arrival
```
Landing page / deep link (no token)
  → Role-picker modal shown immediately
      ┌────────────────────────────────────┐
      │  Welcome to Learnfyra              │
      │  I am a...                         │
      │  ○ Student  ○ Teacher  ○ Parent    │
      │                                    │
      │  [Login / Sign Up]                 │
      │  [Continue as Guest →]             │
      └────────────────────────────────────┘
  → User picks role + clicks "Continue as Guest"
  → Frontend calls POST /auth/guest { role: "student" }
  → Lambda issues guest JWT, sets cookie (30 days)
  → Page renders with soft banner: "Login to save your progress"
  → Modal does NOT appear again this session
```

### 3.3 Guest User — Returning (cookie present)
```
Any page
  → guest JWT cookie present and valid
  → No modal shown
  → Soft banner shown once per session if near limit (≥8/10 worksheets used)
```

### 3.4 Guest → Authenticated Transition
```
Guest clicks Login / Sign Up
  → Frontend saves current URL to sessionStorage key: "learnfyra_pre_login_url"
  → OAuth redirect to Cognito Hosted UI
  → Post-callback: Cognito JWT issued, stored in cookie
  → Frontend reads sessionStorage, redirects user back to original URL
  → Guest cookie cleared
  → Guest DynamoDB data expires naturally via TTL (30 days)
  → Authenticated user starts clean record in Users table
```

### 3.5 Guest Worksheet Limit Hit
```
Guest attempts POST /worksheet when count = 10
  → Lambda checks GuestSessions.worksheetIds.size ≥ 10
  → Returns 403 { code: "GUEST_LIMIT_REACHED", message: "..." }
  → Frontend shows modal: "You've used your 10 free worksheets. Login to continue."
```

---

## 4. API Contracts

### 4.1 POST /auth/guest
Issues a guest JWT. Public endpoint — no Authorization header required.

**Request**
```json
{
  "role": "student" | "teacher" | "parent"
}
```

**Response 200**
```json
{
  "guestToken": "<signed JWT>",
  "guestId": "guest_<uuid>",
  "expiresAt": "<ISO timestamp>"
}
```
Sets cookie: `guestToken=<jwt>; SameSite=Strict; Secure; Max-Age=2592000; Path=/`

**Response 400** — missing or invalid role  
**Response 429** — IP rate limit exceeded

**JWT Claims**
```json
{
  "sub": "guest_<uuid>",
  "role": "guest-student",
  "token_use": "guest",
  "iss": "learnfyra-guest-issuer",
  "exp": "<30 days from now>"
}
```

---

### 4.2 GET /guest/preview?role=teacher|parent
Returns fixture data for Guest Teacher and Guest Parent role previews. No auth required.

**Response 200** — role-appropriate hardcoded JSON fixture (class list, student summary, etc.)  
**Response 400** — invalid role param  
**Response 403** — called with role=student (students get real data, not fixtures)

---

### 4.3 Lambda Authorizer — Updated Flow
```
Incoming request
  ├── Has Authorization: Bearer <token>
  │     ├── Validate as Cognito JWT (JWKS) → existing flow → Allow with role claim
  │     └── Validate as Guest JWT (symmetric or separate JWKS)
  │           ├── Valid → Allow, attach { role: "guest-student|teacher|parent", guestId }
  │           └── Invalid → Deny
  └── No Authorization header
        └── Deny → 401
```

The authorizer must support **two token issuers**: Cognito (existing) and `learnfyra-guest-issuer` (new). It should NOT accept requests with no token — all pages require either a Cognito JWT or a valid guest JWT.

---

### 4.4 Worksheet Limit Check — POST /worksheet (updated)
Before triggering Step Functions:
1. Extract `guestId` from authorizer context (if `role` starts with `guest-`)
2. Read `GuestSessions` item `PK=GUEST#<guestId>`
3. If `worksheetIds.size >= 10` → return 403 `GUEST_LIMIT_REACHED`
4. If input validation fails → return 400 (no slot consumed)
5. Else → start Step Functions, then atomically `ADD worksheetId to worksheetIds Set`

---

## 5. Data Model

### 5.1 GuestSessions Table
```
Table: GuestSessions
PK: GUEST#<guestId>          (String)

Attributes:
  guestId        String       guest_<uuid>
  role           String       guest-student | guest-teacher | guest-parent
  worksheetIds   StringSet    Set of worksheetIds accessed (max 10)
  createdAt      String       ISO timestamp
  ttl            Number       Unix timestamp = createdAt + 30 days
```

**Access patterns:**
- Read by PK on every `POST /worksheet` (limit check)
- Atomic `ADD worksheetId` on successful generation start
- Auto-deleted by DynamoDB TTL after 30 days

**No GSI required.** Single-item reads only.

---

### 5.2 No Users Table Record for Guests
Guests do NOT get a record in the `Users` table. The `GuestSessions` table is the only persistence layer for guest state.

---

## 6. Frontend — Auth Context Changes

### 6.1 Token State Enum
Replace the existing boolean `isAuthenticated` with a three-way enum:

```typescript
type TokenState = 'none' | 'guest' | 'authenticated'

interface AuthContext {
  tokenState: TokenState
  role: 'guest-student' | 'guest-teacher' | 'guest-parent' | 'student' | 'teacher' | 'parent' | null
  userId: string | null        // Cognito sub for authenticated users
  guestId: string | null       // guest_<uuid> for guest users
  displayName: string | null
  email: string | null
}
```

**All existing components** that currently check `isAuthenticated` must be migrated to check `tokenState`.

---

### 6.2 Role-Picker Modal
- Shown when: any page loads and `tokenState === 'none'`
- Dismissed after: user clicks "Continue as Guest" OR "Login / Sign Up"
- Not shown again: for the remainder of the session (sessionStorage flag `learnfyra_modal_shown`)
- Shown again: if guest hits a protected action (e.g. limit reached, tries to access progress dashboard)

---

### 6.3 Soft Banner (persistent, dismissible)
- Shown when: `tokenState === 'guest'`
- Content: "Login to save your progress and unlock unlimited worksheets"
- Dismissed: per session (sessionStorage flag `learnfyra_banner_dismissed`)
- Re-shown: when `worksheetIds.size >= 8` (approaching limit), not dismissible at that point

---

### 6.4 Pre-Login URL Preservation
```typescript
// Before triggering OAuth redirect
sessionStorage.setItem('learnfyra_pre_login_url', window.location.pathname + window.location.search)

// In /callback route, after token stored
const returnUrl = sessionStorage.getItem('learnfyra_pre_login_url')
sessionStorage.removeItem('learnfyra_pre_login_url')
navigate(returnUrl ?? '/dashboard')
```

---

## 7. Guest Permission Matrix

| Action | guest-student | guest-teacher | guest-parent |
|---|---|---|---|
| View landing page | ✅ | ✅ | ✅ |
| View `/worksheet/new` form | ✅ | ✅ (fixture data) | ✅ (fixture data) |
| Submit worksheet generation | ✅ (counts toward limit) | ❌ → nudge | ❌ → nudge |
| Solve worksheet online | ✅ (same worksheetId = free) | ❌ → nudge | ❌ → nudge |
| Download worksheet | ✅ (same worksheetId = free) | ❌ → nudge | ❌ → nudge |
| View progress dashboard | ❌ → nudge | ❌ → nudge (fixture preview) | ❌ → nudge (fixture preview) |
| Save attempt progress | ❌ → nudge | ❌ | ❌ |
| Create/manage classes | ❌ | ❌ → nudge | ❌ |
| View class roster | ❌ | ❌ → nudge (fixture) | ❌ → nudge (fixture) |
| Change own role | ❌ | ❌ | ❌ |

---

## 8. Infrastructure

### 8.1 New Lambda Functions
| Lambda | Trigger | Purpose |
|---|---|---|
| `GuestTokenIssuerLambda` | API Gateway POST /auth/guest | Issues signed guest JWT, creates GuestSessions record |
| `GuestFixtureLambda` | API Gateway GET /guest/preview | Returns hardcoded fixture JSON per role |

### 8.2 Lambda Authorizer Changes
- Add second issuer validation path for `learnfyra-guest-issuer`
- Guest JWT secret/key stored in AWS Secrets Manager (not hardcoded)
- Attach `guestId` and `role` to request context on success

### 8.3 API Gateway Usage Plans
- New usage plan: `guest-unauthenticated`
  - Rate: 10 req/sec per IP
  - Burst: 20
  - Applied to: `POST /auth/guest` only
- Existing authenticated usage plan: unchanged

### 8.4 DynamoDB
- New table: `GuestSessions` (on-demand billing — cost-appropriate for sparse guest reads)
- TTL attribute: `ttl` (enable TTL on this attribute in CDK)
- No GSI

### 8.5 CDK Environment Isolation
- `GuestSessions` table deployed per environment (dev / qa / prod)
- Guest JWT signing secret per environment in Secrets Manager
- Fixture Lambda environment variable: `ENV=dev|qa|prod` (for any future env-specific fixture differences)

---

## 9. Security Considerations

- Guest JWT signing key stored in **AWS Secrets Manager**, rotated quarterly
- `token_use: "guest"` claim must be validated by authorizer — cannot be mistaken for a Cognito access token
- `iss: "learnfyra-guest-issuer"` validated strictly — wrong issuer = Deny
- `None` algorithm attack: rejected by JWT library configuration (existing protection, confirmed also applies to guest path)
- Guest JWTs carry no PII — only `guestId`, `role`, `exp`
- IP throttling on `/auth/guest` prevents bulk token farming

---

## 10. Out of Scope for This Implementation

- CAPTCHA on guest token issuance (deferred to Phase 2 if abuse detected)
- Guest worksheet history visible post-login (no migration, data expires)
- Guest-to-guest role switching (role is fixed at token issuance)
- Microsoft/GitHub OAuth (existing future enhancement, unaffected)
- MFA (unaffected)
