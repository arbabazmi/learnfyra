# Learnfyra — Guest Auth Spec: Architecture Review Patch
> Version: 1.1 — applies on top of learnfyra-guest-auth-spec.md v1.0
> Triggered by: Architecture Agent D1–D6 risky assumption resolutions
> Status: APPROVED — supersedes conflicting sections in v1.0
> Date: 2026-04-02

---

## HOW TO USE THIS FILE

Read learnfyra-guest-auth-spec.md v1.0 first.
Then apply every correction below. Where this file conflicts with v1.0, this file wins.
Six corrections total. All are mandatory before the Dev Agent begins Step 1.

---

## PATCH D1 — JWT Signing Key Strategy
### Supersedes: Section 8.2 (New Lambda Functions), Section 9 (Security Considerations)

**REMOVE** from the spec:
- "Guest JWT signing key stored in AWS Secrets Manager, rotated quarterly"
- "Separate secret: learnfyra/{env}/guest-jwt-secret"
- Any reference to a separate signing key for guest tokens

**REPLACE WITH:**

Guest tokens use the **same `JWT_SECRET`** as all other tokens in the system.
Differentiation between token types is done by `iss` claim routing in the authorizer,
not by key separation.

**Rationale:** A separate key adds two Secrets Manager reads on cache miss, complicates
the authorizer, and provides no security gain at MVP — the `iss` + `token_use` claims
already make guest tokens structurally unacceptable as Cognito tokens and vice versa.

**Impact on CDK:** No new Secrets Manager secret resource needed for guest JWT.
Remove `GuestJwtSecret` CDK construct if already scaffolded.

**Impact on DevOps Prompt Phase 1 & 2:** Remove all steps relating to provisioning
`learnfyra/{env}/guest-jwt-secret`. The existing `JWT_SECRET` secret covers guest tokens.

---

## PATCH D2 — DynamoDB StringSet Marshalling
### Supersedes: Section 5.1 (GuestSessions Table), Step 5 in Backend Dev Prompt

**ADD** the following implementation constraint to Section 5.1 and Backend Dev Prompt Step 5:

**StringSet ADD operation — mandatory pattern (Node.js 18 + @aws-sdk/lib-dynamodb):**

```typescript
// CORRECT — use createSet() from the document client
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

await docClient.send(new UpdateCommand({
  TableName: "GuestSessions-dev",
  Key: { PK: `GUEST#${guestId}` },
  UpdateExpression: "ADD worksheetIds :id",
  ExpressionAttributeValues: {
    ":id": docClient.schema.createSet([worksheetId])
  }
}));

// INCORRECT — do NOT use a plain JS Set or array:
// ":id": new Set([worksheetId])   ← will throw or silently fail
// ":id": [worksheetId]            ← wrong type, will error
```

**Mandatory unit test:** Dev Agent must include a test that:
1. Calls the ADD operation with a worksheetId
2. Reads the item back
3. Asserts the worksheetIds Set contains exactly that worksheetId
This catches marshalling failures that only surface at runtime.

---

## PATCH D3 — CloudFront Cookie Pass-Through
### Supersedes: Section 4.1 (POST /auth/guest), Section 8 (Infrastructure)

**ADD** the following to Section 8 (Infrastructure) as new subsection 8.6:

### 8.6 CloudFront Behaviour for /auth/guest

CloudFront strips `Set-Cookie` headers from cached responses by default.
`POST /auth/guest` must be excluded from caching entirely.

**CDK requirement — add a dedicated CloudFront behaviour:**
```typescript
distribution.addBehavior("/auth/guest", apiOrigin, {
  cachePolicy: CachePolicy.CACHING_DISABLED,
  allowedMethods: AllowedMethods.ALLOW_ALL,
  originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
});
```

**Lambda response requirement — GuestTokenIssuerLambda must return:**
```typescript
return {
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    // Exact casing required — API Gateway proxy is case-sensitive on Set-Cookie
    "Set-Cookie": `guestToken=${jwt}; SameSite=Strict; Secure; Max-Age=2592000; Path=/; Domain=${process.env.COOKIE_DOMAIN}`
  },
  body: JSON.stringify({ guestToken: jwt, guestId, expiresAt })
};
```

**Dev verification step:** After deploying to dev, open browser DevTools → Network tab →
call POST /auth/guest → confirm `Set-Cookie` header is present in the actual HTTP response
(not just the Lambda return value). If missing, CloudFront is stripping it.

---

## PATCH D4 — Cookie Domain Scope
### Supersedes: Section 6.5 (Pre-Login URL Preservation), Section 4.1 (POST /auth/guest response)

**REPLACE** the cookie definition in Section 4.1 from:
```
Set-Cookie: guestToken=<jwt>; SameSite=Strict; Secure; Max-Age=2592000; Path=/
```

**WITH:**
```
Set-Cookie: guestToken=<jwt>; SameSite=Strict; Secure; Max-Age=2592000; Path=/; Domain=<env-specific>
```

**Cookie domain per environment — set via Lambda environment variable `COOKIE_DOMAIN`:**

| Environment | COOKIE_DOMAIN value |
|---|---|
| local | `localhost` (no leading dot — localhost is special) |
| dev | `.dev.learnfyra.com` |
| qa | `.qa.learnfyra.com` |
| prod | `.learnfyra.com` |

**CDK requirement — inject per environment into GuestTokenIssuerLambda:**
```typescript
new NodejsFunction(this, "GuestTokenIssuerLambda", {
  environment: {
    COOKIE_DOMAIN: props.cookieDomain,  // passed from env-specific stack config
    JWT_SECRET_ARN: jwtSecret.secretArn,
    TABLE_NAME: guestSessionsTable.tableName,
  }
});
```

**Rationale:** Without `Domain=.dev.learnfyra.com`, a cookie set by
`api.dev.learnfyra.com` is invisible to JavaScript running on
`web.dev.learnfyra.com`. The leading dot means all subdomains of that env domain.

**Frontend impact:** No change needed — the browser handles domain-scoped cookies
automatically once the correct Domain attribute is set by the server.

---

## PATCH D5 — Lambda Authorizer Routing by iss Claim
### Supersedes: Section 4.3 (Lambda Authorizer Updated Flow), Backend Dev Prompt Step 4

**REPLACE** the authorizer flow in Section 4.3 with:

```
Incoming request with Authorization: Bearer <token>
  │
  ├── 1. jwt.decode(token) — NO verification, just decode to read claims
  │         If decode fails → Deny immediately
  │
  ├── 2. Route by iss claim:
  │
  │   decoded.iss === "learnfyra-guest-issuer"
  │   ├── YES → Guest path:
  │   │         jwt.verify(token, JWT_SECRET, { issuer: "learnfyra-guest-issuer" })
  │   │         Check token_use === "guest"
  │   │         Check exp not in past
  │   │         On success → Allow, attach { role, guestId, tokenType: "guest" }
  │   │         On failure → Deny
  │   │
  │   └── NO → Cognito path (existing logic — UNCHANGED):
  │             Fetch JWKS from Cognito
  │             Verify signature, exp, issuer (Cognito pool URL), audience
  │             On success → Allow, attach Cognito claims
  │             On failure → Deny
  │
  └── No token / empty header → Deny → 401
```

**Critical implementation note:**
- `jwt.decode()` is called FIRST with NO verification — this is intentional and safe
  because it is used only for routing, not for trusting the token contents
- Actual trust is established in the subsequent `jwt.verify()` call on the correct path
- Existing Cognito tokens already carry `iss: "https://cognito-idp..."` — they will
  NEVER match `"learnfyra-guest-issuer"`, so the Cognito path is completely unaffected
- Do NOT change `signToken()` or any other existing token-related function
- The `None` algorithm attack is blocked by `jwt.verify()` — confirm the existing
  `algorithms: ["RS256"]` option on the Cognito path is also set to `algorithms: ["HS256"]`
  on the guest path (never allow algorithm auto-detection)

---

## PATCH D6 — Per-IP Rate Limiting via WAF (not API Gateway Usage Plans)
### Supersedes: Section 8.3 (API Gateway Usage Plans), DevOps Prompt Phase 1 & 4

**REMOVE** from spec and DevOps prompt:
- "New usage plan: guest-unauthenticated, Rate: 10 req/sec per IP, Burst: 20"
- Any reference to API Gateway usage plans for per-IP rate limiting

**REPLACE WITH:**

API Gateway usage plans throttle by API key, NOT by IP address.
Per-IP rate limiting requires AWS WAF with a rate-based rule.

**CDK requirement — add to the CDK stack that manages API Gateway:**
```typescript
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";

const guestRateLimitWebACL = new CfnWebACL(this, "GuestRateLimitACL", {
  scope: "REGIONAL",
  defaultAction: { allow: {} },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: `GuestRateLimit-${props.env}`,
    sampledRequestsEnabled: true,
  },
  rules: [
    {
      name: "GuestTokenIssuerRateLimit",
      priority: 1,
      action: { block: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `GuestTokenIssuerRateLimit-${props.env}`,
        sampledRequestsEnabled: true,
      },
      statement: {
        rateBasedStatement: {
          limit: 20,                    // 20 requests per 5-minute window per IP
          aggregateKeyType: "IP",
          scopeDownStatement: {
            byteMatchStatement: {
              fieldToMatch: { uriPath: {} },
              positionalConstraint: "EXACTLY",
              searchString: "/auth/guest",
              textTransformations: [{ priority: 0, type: "NONE" }],
            },
          },
        },
      },
    },
  ],
});

// Associate WAF with API Gateway stage
new CfnWebACLAssociation(this, "GuestRateLimitACLAssociation", {
  resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
  webAclArn: guestRateLimitWebACL.attrArn,
});
```

**Behaviour:** A single IP hitting `POST /auth/guest` more than 20 times in any
5-minute sliding window receives a 403 response from WAF (WAF returns 403 by default
on block — this is acceptable; the frontend should treat any 4xx on this endpoint
as rate-limited and show "Too many requests, please wait").

**DevOps Prompt update — Phase 4 alerting:**
Replace the 429 metric with:
- Metric: `GuestTokenIssuerRateLimit` (WAF, namespace: `AWS/WAFV2`)
- Alert: `BlockedRequests > 50 in 5 min` → SNS alert (possible coordinated abuse)

**Environment scope — WAF is PROD ONLY:**
- dev: NO WAF — dev and qa environments are torn down after development completes.
  Abuse risk during the development window is acceptable.
- qa: NO WAF — same rationale as dev.
- prod: WAF deployed as described above.

The CDK construct must be conditional on environment:
```typescript
if (props.env === "prod") {
  const guestRateLimitWebACL = new CfnWebACL(this, "GuestRateLimitACL", { ... });
  new CfnWebACLAssociation(this, "GuestRateLimitACLAssociation", { ... });
}
```

This keeps dev and qa CDK stacks lean and avoids the ~$5/month WAF WebACL cost
on environments that will be decommissioned post-development.

**DevOps Prompt update — Phase 1 pre-deployment checklist:**
The WAF checklist item applies to prod deployment only (Phase 6), not dev or qa.
Remove WAF verification from Phase 2 (dev) and Phase 3 (qa) checklists entirely.

---

## SUMMARY — WHAT CHANGED FROM v1.0

| Patch | Section affected | Change type |
|---|---|---|
| D1 | §8.2, §9, DevOps Phase 1&2 | REMOVE separate guest JWT secret — use shared JWT_SECRET |
| D2 | §5.1, Backend Dev Step 5 | ADD StringSet marshalling constraint + mandatory unit test |
| D3 | §4.1, §8 (new §8.6) | ADD CloudFront CACHING_DISABLED behaviour + Cache-Control header |
| D4 | §4.1, §8 CDK constructs | ADD COOKIE_DOMAIN env var per environment, update cookie string |
| D5 | §4.3, Backend Dev Step 4 | REPLACE authorizer flow — decode-first, route by iss, then verify |
| D6 | §8.3, DevOps Phase 1&4&6 | REPLACE usage plan throttling with WAF rate-based rule — PROD ONLY, CDK conditional on env |

---

## HANDOFF INSTRUCTION FOR DEV AGENT

Before writing any code, read in this order:
1. learnfyra-guest-auth-spec.md (v1.0 — base spec)
2. learnfyra-guest-auth-spec-patch.md (this file — v1.1 corrections)
3. learnfyra-guest-auth-agent-prompts.md (your implementation steps)
4. learnfyra-guest-auth-devops-prompt.md (infrastructure constraints)

Where any of these conflict, priority order is:
**spec-patch.md > agent-prompts.md > spec.md**

Do not begin Step 1 until you have confirmed you understand all six patches.
State which patches affect your implementation steps before writing the first line of code.
