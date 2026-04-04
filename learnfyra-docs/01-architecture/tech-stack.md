# Technology Stack

## Application Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 18+ | ESM modules throughout (`"type": "module"`) |
| AI | Anthropic Claude API | SDK 0.36.3 | `claude-sonnet-4-20250514` default |
| CLI | Inquirer | 9.3.7 | Interactive prompts for local CLI mode |
| PDF Export | Puppeteer | 22.15.0 | US Letter (8.5"×11"), 0.75" margins |
| DOCX Export | docx | 8.5.0 | width=12240, height=15840 DXA, margins=1440 DXA |
| HTTP Server (local) | Express | 4.x | Dev server only — wraps Lambda handlers |
| Test Framework | Jest | 29.7.0 | ESM mode via `--experimental-vm-modules` |
| AWS SDK | @aws-sdk/client-* | v3 | Modular imports, tree-shakeable |
| AWS Mock | aws-sdk-client-mock | latest | Used in all unit/integration tests |
| IaC | AWS CDK | TypeScript | infra/ directory |
| Bundler | esbuild | via CDK NodejsFunction | Lambda bundle optimization |

## Frontend Stack (Phase 1 — Current)

| Layer | Technology | Notes |
|---|---|---|
| Markup | Plain HTML5 | index.html, solve.html, login.html |
| Styles | Plain CSS3 | CSS custom properties (design tokens) |
| Scripts | Vanilla JS (ESM) | fetch API, no framework |
| Fonts | Google Fonts | Nunito (headings) + Inter (body) |
| Icons | None (Phase 1) | SVG inline or emoji for minimal iconography |

## Frontend Stack (Phase 2 — Planned)

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 18+ | Functional components, hooks, context API |
| Routing | React Router v6+ | File-based and dynamic routing |
| State | React Context + Redux Toolkit | Context for UI state, Redux for global/async |
| HTTP | Fetch API / Axios | API calls, interceptors for auth token injection |
| Forms | React Hook Form | Typed forms with validation |
| Design System | Custom (Learnfyra DS) | Built on existing CSS token system |
| Build | Vite + esbuild | Fast dev/build, optimized bundles |

## AWS Stack

| Service | Usage |
|---|---|
| Lambda | All compute (14 functions — includes COPPA consent + parent handlers) |
| API Gateway | REST API, throttling, request validation |
| CloudFront | CDN, HTTPS termination, WAF |
| S3 | Worksheet files (PDF/DOCX/HTML/JSON) + static frontend |
| DynamoDB | Question bank, users, attempts, config, COPPA consent (PendingConsent + ConsentLog) |
| Cognito | Auth — User Pool + Hosted UI + Google OAuth |
| Secrets Manager | API keys, OAuth secrets, JWT secrets |
| CloudWatch | Logs, metrics, alarms, dashboards |
| ACM | TLS certificates (us-east-1 for CloudFront) |
| Route 53 | DNS hosting for learnfyra.com |
| SNS | Ops alert notifications |
| SES | COPPA consent emails to parents (sender verification per env) |
| X-Ray | Lambda distributed tracing (staging + prod) |

## Design Tokens

Defined in `frontend/css/styles.css` as CSS custom properties:

```css
:root {
  /* Colors */
  --primary: #00BFA5;        /* Teal — primary brand color */
  --primary-dark: #00897B;   /* Teal dark — hover states */
  --accent: #FF7043;         /* Orange — CTAs, highlights */
  --accent-dark: #E64A19;    /* Orange dark — hover states */
  --success: #4CAF50;        /* Green — correct answers, success states */
  --error: #F44336;          /* Red — incorrect answers, error states */
  --warning: #FFC107;        /* Amber — warnings, caution */
  --neutral-900: #212121;    /* Near-black — body text */
  --neutral-700: #616161;    /* Dark grey — secondary text */
  --neutral-300: #E0E0E0;    /* Light grey — borders, dividers */
  --neutral-100: #F5F5F5;    /* Off-white — backgrounds */
  --white: #FFFFFF;

  /* Typography */
  --font-primary: 'Nunito', 'Helvetica Neue', sans-serif;   /* Headings, labels */
  --font-body: 'Inter', 'Helvetica Neue', sans-serif;        /* Body text, inputs */
  --font-mono: 'Fira Code', 'Courier New', monospace;        /* Code, answers */

  /* Font Sizes */
  --text-xs: 0.75rem;   /* 12px */
  --text-sm: 0.875rem;  /* 14px */
  --text-base: 1rem;    /* 16px */
  --text-lg: 1.125rem;  /* 18px */
  --text-xl: 1.25rem;   /* 20px */
  --text-2xl: 1.5rem;   /* 24px */
  --text-3xl: 1.875rem; /* 30px */

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.15);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.18);
}
```

## Environment Variables Reference

### Lambda Environment (injected by CDK at deploy)

| Variable | Source | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secrets Manager | Claude API key |
| `WORKSHEET_BUCKET_NAME` | CDK output | S3 bucket name for worksheets |
| `ALLOWED_ORIGIN` | CDK output | CloudFront domain for CORS |
| `CLAUDE_MODEL` | CDK context | Default: `claude-sonnet-4-20250514` |
| `NODE_ENV` | CDK context | `dev` \| `staging` \| `prod` |
| `APP_RUNTIME` | CDK context | `aws` (Lambda always) |
| `QB_ADAPTER` | CDK context | `dynamodb` (Lambda always) |
| `COGNITO_USER_POOL_ID` | CDK output | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | CDK output | Cognito App Client ID |
| `SECRET_ARN` | CDK output | Secrets Manager ARN for runtime secret fetch |

### Local Development (.env file)

| Variable | Example Value | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API key |
| `DEFAULT_OUTPUT_DIR` | `./worksheets` | Local output directory |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model ID |
| `NODE_ENV` | `development` | Environment name |
| `APP_RUNTIME` | `local` | Disables S3/DynamoDB, uses file system |
| `QB_ADAPTER` | `local` | Uses local JSON adapter for Question Bank |
| `LOCAL_JWT_SECRET` | `dev-secret-min-32-chars` | JWT signing secret for local auth |
| `PORT` | `3000` | Express dev server port |

### GitHub Actions Secrets

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM deploy user key |
| `AWS_SECRET_ACCESS_KEY` | IAM deploy user secret |
| `AWS_REGION` | `us-east-1` |
| `ANTHROPIC_API_KEY_DEV` | Anthropic key for dev Lambda |
| `ANTHROPIC_API_KEY_STAGING` | Anthropic key for staging Lambda |
| `ANTHROPIC_API_KEY_PROD` | Anthropic key for prod Lambda |

## AI Model Configuration

| Model | ID | Use Case | Cost Tier |
|---|---|---|---|
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | Default worksheet generation | Medium |
| Claude Haiku | `claude-haiku-*` | Cost-optimized fallback | Low |
| Claude Opus | `claude-opus-*` | High-quality curriculum verification | High |

Model routing is managed by M07 Admin Control Plane. Hot-swap between models does not require redeploy — model ID is read from DynamoDB Config table at runtime.

Parameters used in all Claude API calls:
- `max_tokens`: 8192
- `temperature`: 0.7 (configurable via Config table)
- `system`: curriculum-aligned system prompt (built by `src/ai/promptBuilder.js`)

## Local Dev Service Adapter Pattern

```
APP_RUNTIME=local              APP_RUNTIME=aws
┌──────────────┐              ┌──────────────┐
│ File System  │              │     S3       │
│ (worksheets- │              │ (learnfyra-  │
│  local/)     │              │  {env}-s3-   │
└──────────────┘              │  worksheets) │
                              └──────────────┘

QB_ADAPTER=local              QB_ADAPTER=dynamodb
┌──────────────┐              ┌──────────────┐
│ Local JSON   │              │  DynamoDB    │
│ Files        │              │  (AWS SDK v3)│
└──────────────┘              └──────────────┘
```

The adapter pattern ensures no code changes are needed when moving from local to AWS. The factory function in `src/questionBank/index.js` reads the env var and returns the correct adapter instance.

## Competitive Positioning

| Dimension | EduSheets.io | EduSheetHub.com | Learnfyra |
|---|---|---|---|
| Tone | Corporate, sterile | Amateur, cluttered | Joyful + Trustworthy |
| Color | Muted blues | Rainbow clash | Teal + Orange system |
| Typography | Default web fonts | Inconsistent | Nunito + Inter pairing |
| Curriculum | Partial CCSS | None specified | Full CCSS + NGSS + C3 + NHES |
| Online Solve | No | No | Yes (M04) |
| Progress Tracking | No | No | Yes (M05) |
| Teacher Tools | Minimal | None | Full class management (M06) |
