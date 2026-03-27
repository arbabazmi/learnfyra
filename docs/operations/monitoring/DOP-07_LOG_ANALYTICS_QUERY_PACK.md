# DOP-07 Log Analytics Query Pack (IaC-Managed)

Date: 2026-03-26
Scope: Dev, Staging, Prod
Owner: DevOps + QA

## IaC Coverage Summary
- API Gateway access logging is enabled with structured JSON output to env-specific log groups.
- CloudWatch Logs Insights query definitions are provisioned by CDK for each environment.
- Backend observability dashboard includes log-query drill-down panels and link to query definitions.

## Query Inventory (Env-Aware Names)

1. learnfyra-{env}-top-errors-by-function
- Source log groups: all Lambda log groups in stack.
- Purpose: rank top error-producing Lambda functions.
- Typical fields: functionName, errorCount.

2. learnfyra-{env}-auth-failures-by-route
- Source log group: /aws/apigateway/learnfyra-{env}-access-logs.
- Purpose: identify 401/403 trends by API route and status.
- Typical fields: route, status, authFailures.

3. learnfyra-{env}-high-latency-request-traces
- Source log group: /aws/apigateway/learnfyra-{env}-access-logs.
- Purpose: inspect slow requests and request IDs for tracing.
- Typical fields: route, status, responseLatency, integrationLatency, requestId.

4. learnfyra-{env}-4xx-5xx-route-hotspots
- Source log group: /aws/apigateway/learnfyra-{env}-access-logs.
- Purpose: rank client/server error hotspots by route.
- Typical fields: route, status, errorRequests.

## Dashboard Drill-Down Panels

Dashboard: learnfyra-{env}-backend-observability

Added panels:
1. Log Drilldown: Top Errors by Function
2. Log Drilldown: Auth Failures by Route (401/403)
3. Log Drilldown: High-Latency Request Traces
4. Log Drilldown: 4XX/5XX Route Hotspots

Navigation aid:
- Text widget link to CloudWatch Logs Insights query definitions for fast run/review.

## Validation Notes

Infrastructure validation:
- CDK TypeScript compile passed (`npm run build` in infra/cdk).
- CDK tests passed (`npm test` in infra/cdk): 31/31.

Test evidence checks include:
- API access log group synthesized with 30-day retention.
- API stage synthesized with AccessLogSetting.
- 4 query definitions synthesized with expected env-aware names.
- Dashboard resource synthesized with observability panels.

## Example Results (Representative)

Example A: top-errors-by-function
- functionName: learnfyra-dev-lambda-submit
- errorCount: 17

Example B: auth-failures-by-route
- route: POST /api/auth/login
- status: 401
- authFailures: 42

Example C: high-latency-request-traces
- route: POST /api/submit
- status: 200
- responseLatency: 2875
- integrationLatency: 2301
- requestId: 3fd6a4f6-...-8e19

Example D: 4xx-5xx-route-hotspots
- route: GET /api/solve/{worksheetId}
- status: 404
- errorRequests: 64

## Operational Usage
- Start from triggered Lambda/API alarms in dashboard.
- Open corresponding log drill-down panel.
- Pivot using requestId and route for rapid root-cause triage.
