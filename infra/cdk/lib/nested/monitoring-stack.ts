/**
 * @file infra/cdk/lib/nested/monitoring-stack.ts
 * @description NestedStack: All CloudWatch alarms + dashboard + log query definitions.
 *              Estimated CloudFormation resources: ~72
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { BaseNestedStackProps, MonitoredFunction, ApiOutputs, ComputeOutputs } from '../types';

export interface MonitoringStackProps extends BaseNestedStackProps {
  api: apigateway.RestApi;
  apiAccessLogGroup: logs.LogGroup;
  compute: ComputeOutputs;
  isDev: boolean;
  isProd: boolean;
}

export class MonitoringStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { appEnv, api, apiAccessLogGroup, compute, isDev, isProd } = props;

    const monitoredFunctions: MonitoredFunction[] = [
      { id: 'Generate',     fn: compute.generateFn,      p95MsThreshold: isDev ? 30000 : 45000 },
      { id: 'Download',     fn: compute.downloadFn,      p95MsThreshold: 4000 },
      { id: 'Auth',         fn: compute.authFn,          p95MsThreshold: 3000 },
      { id: 'Solve',        fn: compute.solveFn,         p95MsThreshold: 4000 },
      { id: 'Submit',       fn: compute.submitFn,        p95MsThreshold: 5000 },
      { id: 'Progress',     fn: compute.progressFn,      p95MsThreshold: 4000 },
      { id: 'Analytics',    fn: compute.analyticsFn,     p95MsThreshold: 4000 },
      { id: 'Class',        fn: compute.classFn,         p95MsThreshold: 3000 },
      { id: 'Rewards',      fn: compute.rewardsFn,       p95MsThreshold: 3000 },
      { id: 'Student',      fn: compute.studentFn,       p95MsThreshold: 3000 },
      { id: 'Admin',        fn: compute.adminFn,         p95MsThreshold: 4000 },
      { id: 'Dashboard',    fn: compute.dashboardFn,     p95MsThreshold: 4000 },
      { id: 'Certificates', fn: compute.certificatesFn,  p95MsThreshold: 3000 },
      { id: 'AdminPolicies',fn: compute.adminPoliciesFn, p95MsThreshold: 4000 },
      { id: 'Feedback',     fn: compute.feedbackFn,      p95MsThreshold: 3000 },
    ];

    // ── Per-function alarms: errors + p95 duration + error rate ──────────────

    monitoredFunctions.forEach(({ id, fn, p95MsThreshold }) => {
      new cloudwatch.Alarm(this, `${id}LambdaErrorsAlarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-errors`,
        metric: fn.metricErrors({ period: cdk.Duration.minutes(1), statistic: 'sum' }),
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda error count is >= 1 over 1 minute in ${appEnv}`,
      });

      new cloudwatch.Alarm(this, `${id}LambdaDurationP95Alarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-duration-p95`,
        metric: fn.metricDuration({ period: cdk.Duration.minutes(1), statistic: 'p95' }),
        threshold: p95MsThreshold,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda p95 duration exceeded ${p95MsThreshold}ms in ${appEnv}`,
      });

      const errorRateMetric = new cloudwatch.MathExpression({
        expression: '100 * errors / IF(invocations > 0, invocations, 1)',
        label: `${id} Error Rate %`,
        period: cdk.Duration.minutes(5),
        usingMetrics: {
          errors: fn.metricErrors({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
          invocations: fn.metricInvocations({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
        },
      });

      new cloudwatch.Alarm(this, `${id}LambdaErrorRateAlarm`, {
        alarmName: `learnfyra-${appEnv}-${id.toLowerCase()}-error-rate`,
        metric: errorRateMetric,
        threshold: 5,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: `${id} Lambda error rate exceeded 5% over 5 minutes in ${appEnv}`,
      });
    });

    // ── API Gateway alarms ───────────────────────────────────────────────────

    new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: `learnfyra-${appEnv}-api-5xx-errors`,
      metric: api.metricServerError({ period: cdk.Duration.minutes(1), statistic: 'sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway 5XX errors detected in ${appEnv}`,
    });

    new cloudwatch.Alarm(this, 'ApiGatewayLatencyP95Alarm', {
      alarmName: `learnfyra-${appEnv}-api-latency-p95`,
      metric: api.metricLatency({ period: cdk.Duration.minutes(1), statistic: 'p95' }),
      threshold: 5000,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway p95 latency exceeded 5000ms in ${appEnv}`,
    });

    new cloudwatch.Alarm(this, 'ApiGatewayThrottleAlarm', {
      alarmName: `learnfyra-${appEnv}-api-throttle-detected`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
        dimensionsMap: { ApiName: api.restApiName, Stage: appEnv },
      }),
      threshold: isProd ? 9000 : 3000,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway approaching request rate limits (>80% capacity) in ${appEnv}. May indicate throttling risk.`,
    });

    new cloudwatch.Alarm(this, 'ApiGatewaySurgeAlarm', {
      alarmName: `learnfyra-${appEnv}-api-surge-detected`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Count',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: { ApiName: api.restApiName, Stage: appEnv },
      }),
      threshold: isProd ? 10000 : 500,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `API Gateway detecting unusual traffic surge (>200% baseline) in ${appEnv}. Possible DDoS or load test.`,
    });

    // ── Log Insights query definitions ───────────────────────────────────────

    const lambdaLogGroupNames = [
      compute.generateFn,
      compute.downloadFn,
      compute.authFn,
      compute.solveFn,
      compute.submitFn,
      compute.progressFn,
      compute.analyticsFn,
      compute.classFn,
      compute.rewardsFn,
      compute.studentFn,
      compute.adminFn,
      compute.feedbackFn,
    ].map((fn: NodejsFunction) => `/aws/lambda/${fn.functionName}`);

    const topErrorsByFunctionQuery = [
      'fields @timestamp, @log, @message',
      '| filter @message like /(?i)error|exception|fail/',
      '| parse @log /\\/aws\\/lambda\\/(?<functionName>[^ ]+)/',
      '| stats count(*) as errorCount by functionName',
      '| sort errorCount desc',
      '| limit 20',
    ];

    const authFailuresByRouteQuery = [
      'fields @timestamp, @message',
      '| parse @message /"routeKey":"(?<route>[^"]+)"/',
      '| parse @message /"status":"?(?<status>\\d+)"?/',
      '| filter status = 401 or status = 403',
      '| stats count(*) as authFailures by route, status',
      '| sort authFailures desc',
      '| limit 20',
    ];

    const highLatencyRequestTraceQuery = [
      'fields @timestamp, @message',
      '| parse @message /"routeKey":"(?<route>[^"]+)"/',
      '| parse @message /"status":"?(?<status>\\d+)"?/',
      '| parse @message /"requestId":"(?<requestId>[^"]+)"/',
      '| parse @message /"responseLatency":"?(?<responseLatency>\\d+)"?/',
      '| parse @message /"integrationLatency":"?(?<integrationLatency>\\d+)"?/',
      '| filter responseLatency > 2000',
      '| sort responseLatency desc',
      '| display @timestamp, route, status, responseLatency, integrationLatency, requestId',
      '| limit 50',
    ];

    const routeHotspots4xx5xxQuery = [
      'fields @timestamp, @message',
      '| parse @message /"routeKey":"(?<route>[^"]+)"/',
      '| parse @message /"status":"?(?<status>\\d+)"?/',
      '| filter status >= 400',
      '| stats count(*) as errorRequests by route, status',
      '| sort errorRequests desc',
      '| limit 30',
    ];

    const costByFunctionQuery = [
      'fields @duration, @initDuration, @functionName',
      '| filter ispresent(@duration)',
      '| stats sum(@duration) as totalDurationMs by @functionName',
      '| sort totalDurationMs desc',
      '| limit 30',
    ];

    const costByEndpointQuery = [
      'fields @timestamp, @message',
      '| parse @message /"routeKey":"(?<route>[^"]+)"/',
      '| parse @message /"responseLatency":"?(?<latency>\\d+)"?/',
      '| stats count(*) as requestCount, avg(latency) as avgLatency by route',
      '| sort requestCount desc',
      '| limit 20',
    ];

    const costEstimationQuery = [
      'fields @duration, @memorySize, @maxMemoryUsed',
      '| filter ispresent(@duration) and ispresent(@memorySize)',
      '| stats count(*) as invocations, avg(@duration) as avgDurationMs, max(@memorySize) as memoryMb',
      '| display invocations, avgDurationMs, memoryMb',
    ];

    const lambdaTopErrorsDefinition = new logs.CfnQueryDefinition(
      this,
      'LambdaTopErrorsQueryDefinition',
      {
        name: `learnfyra-${appEnv}-top-errors-by-function`,
        logGroupNames: lambdaLogGroupNames,
        queryString: topErrorsByFunctionQuery.join('\n'),
      }
    );

    const apiAuthFailuresDefinition = new logs.CfnQueryDefinition(
      this,
      'ApiAuthFailuresQueryDefinition',
      {
        name: `learnfyra-${appEnv}-auth-failures-by-route`,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryString: authFailuresByRouteQuery.join('\n'),
      }
    );

    const apiLatencyTraceDefinition = new logs.CfnQueryDefinition(
      this,
      'ApiHighLatencyTracesQueryDefinition',
      {
        name: `learnfyra-${appEnv}-high-latency-request-traces`,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryString: highLatencyRequestTraceQuery.join('\n'),
      }
    );

    const apiRouteHotspotsDefinition = new logs.CfnQueryDefinition(
      this,
      'ApiRouteHotspotsQueryDefinition',
      {
        name: `learnfyra-${appEnv}-4xx-5xx-route-hotspots`,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryString: routeHotspots4xx5xxQuery.join('\n'),
      }
    );

    new logs.CfnQueryDefinition(this, 'CostByFunctionQueryDefinition', {
      name: `learnfyra-${appEnv}-cost-by-function`,
      logGroupNames: lambdaLogGroupNames,
      queryString: costByFunctionQuery.join('\n'),
    });

    new logs.CfnQueryDefinition(this, 'CostByEndpointQueryDefinition', {
      name: `learnfyra-${appEnv}-cost-by-endpoint`,
      logGroupNames: [apiAccessLogGroup.logGroupName],
      queryString: costByEndpointQuery.join('\n'),
    });

    new logs.CfnQueryDefinition(this, 'CostEstimationQueryDefinition', {
      name: `learnfyra-${appEnv}-cost-estimation`,
      logGroupNames: lambdaLogGroupNames,
      queryString: costEstimationQuery.join('\n'),
    });

    // ── Dashboard ─────────────────────────────────────────────────────────────

    const dashboard = new cloudwatch.Dashboard(this, 'BackendObservabilityDashboard', {
      dashboardName: `learnfyra-${appEnv}-backend-observability`,
    });

    const queryDefinitionsUrl = `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#logs-insights:queryDefinitions`;

    const allFunctionErrors = monitoredFunctions.map(({ id, fn }) =>
      fn.metricErrors({ statistic: 'sum', period: cdk.Duration.minutes(5), label: `${id} Errors` })
    );
    const allFunctionInvocations = monitoredFunctions.map(({ id, fn }) =>
      fn.metricInvocations({ statistic: 'sum', period: cdk.Duration.minutes(5), label: `${id} Invocations` })
    );
    const allFunctionDurationP95 = monitoredFunctions.map(({ id, fn }) =>
      fn.metricDuration({ statistic: 'p95', period: cdk.Duration.minutes(5), label: `${id} p95 Duration` })
    );

    const apiMetricByRoute = (
      metricName: string,
      method: string,
      resource: string,
      statistic = 'Sum'
    ) =>
      new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName,
        statistic,
        period: cdk.Duration.minutes(5),
        dimensionsMap: { ApiName: api.restApiName, Stage: appEnv, Method: method, Resource: resource },
      });

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        width: 24,
        height: 4,
        markdown:
          `# Learnfyra ${appEnv.toUpperCase()} Backend Observability\n` +
          `X-Ray tracing is enabled for staging/prod environments by stack policy.\n` +
          `[Open Log Insights Query Definitions](${queryDefinitionsUrl})\n` +
          `Queries: \`${lambdaTopErrorsDefinition.name}\`, \`${apiAuthFailuresDefinition.name}\`, \`${apiLatencyTraceDefinition.name}\`, \`${apiRouteHotspotsDefinition.name}\``,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors by Function (Top Trend)',
        width: 12,
        height: 6,
        left: allFunctionErrors,
        stacked: true,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations by Function',
        width: 12,
        height: 6,
        left: allFunctionInvocations,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration p95 by Function',
        width: 12,
        height: 6,
        left: allFunctionDurationP95,
      }),
      new cloudwatch.GraphWidget({
        title: 'Critical Duration Profile (p50/p95/p99)',
        width: 12,
        height: 6,
        left: [
          compute.generateFn.metricDuration({ statistic: 'p50', period: cdk.Duration.minutes(5), label: 'Generate p50' }),
          compute.generateFn.metricDuration({ statistic: 'p95', period: cdk.Duration.minutes(5), label: 'Generate p95' }),
          compute.generateFn.metricDuration({ statistic: 'p99', period: cdk.Duration.minutes(5), label: 'Generate p99' }),
          compute.submitFn.metricDuration({ statistic: 'p50', period: cdk.Duration.minutes(5), label: 'Submit p50' }),
          compute.submitFn.metricDuration({ statistic: 'p95', period: cdk.Duration.minutes(5), label: 'Submit p95' }),
          compute.submitFn.metricDuration({ statistic: 'p99', period: cdk.Duration.minutes(5), label: 'Submit p99' }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests / 4XX / 5XX',
        width: 12,
        height: 6,
        left: [
          api.metricCount({ statistic: 'sum', period: cdk.Duration.minutes(5), label: 'Request Count' }),
          api.metricClientError({ statistic: 'sum', period: cdk.Duration.minutes(5), label: '4XX Errors' }),
          api.metricServerError({ statistic: 'sum', period: cdk.Duration.minutes(5), label: '5XX Errors' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency p50/p95/p99',
        width: 12,
        height: 6,
        left: [
          api.metricLatency({ statistic: 'p50', period: cdk.Duration.minutes(5), label: 'Latency p50' }),
          api.metricLatency({ statistic: 'p95', period: cdk.Duration.minutes(5), label: 'Latency p95' }),
          api.metricLatency({ statistic: 'p99', period: cdk.Duration.minutes(5), label: 'Latency p99' }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Route Usage: Auth/Generate/Submit/Solve',
        width: 12,
        height: 6,
        left: [
          apiMetricByRoute('Count', 'POST', '/api/auth/login', 'Sum').with({ label: 'POST /api/auth/login' }),
          apiMetricByRoute('Count', 'POST', '/api/generate', 'Sum').with({ label: 'POST /api/generate' }),
          apiMetricByRoute('Count', 'POST', '/api/submit', 'Sum').with({ label: 'POST /api/submit' }),
          apiMetricByRoute('Count', 'GET', '/api/solve/{worksheetId}', 'Sum').with({ label: 'GET /api/solve/{worksheetId}' }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Route Usage: Progress/QB/Analytics/Class',
        width: 12,
        height: 6,
        left: [
          apiMetricByRoute('Count', 'POST', '/api/progress/save', 'Sum').with({ label: 'POST /api/progress/save' }),
          apiMetricByRoute('Count', 'GET', '/api/progress/history', 'Sum').with({ label: 'GET /api/progress/history' }),
          apiMetricByRoute('Count', 'GET', '/api/qb/questions', 'Sum').with({ label: 'GET /api/qb/questions' }),
          apiMetricByRoute('Count', 'GET', '/api/analytics/class/{id}', 'Sum').with({ label: 'GET /api/analytics/class/{id}' }),
          apiMetricByRoute('Count', 'POST', '/api/class/create', 'Sum').with({ label: 'POST /api/class/create' }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Daily Request Volume (1-hourly aggregation)',
        width: 24,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            dimensionsMap: { ApiName: api.restApiName, Stage: appEnv },
            label: 'API Requests (hourly)',
          }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Generate (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'POST', '/api/generate', 'Sum').with({ label: 'Generate Count' })],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Submit (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'POST', '/api/submit', 'Sum').with({ label: 'Submit Count' })],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Progress (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'GET', '/api/progress/history', 'Sum').with({ label: 'Progress Count' })],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Top Endpoint: Auth (Last 24h)',
        width: 6,
        height: 4,
        metrics: [apiMetricByRoute('Count', 'POST', '/api/auth/login', 'Sum').with({ label: 'Auth Count' })],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Traffic by Hour: Peak Window Analysis',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Average',
            period: cdk.Duration.hours(1),
            dimensionsMap: { ApiName: api.restApiName, Stage: appEnv },
            label: 'Avg Requests/Hour',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Total Compute Time (sum of all functions)',
        width: 12,
        height: 6,
        left: monitoredFunctions.map(({ id, fn }) =>
          fn.metricDuration({ statistic: 'Sum', period: cdk.Duration.minutes(5), label: `${id} Total Time` })
        ),
      })
    );

    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        width: 24,
        height: 3,
        markdown:
          '## Cost Visibility (DOP-08)\n' +
          '**Alarms**: Each Lambda function has error count, p95 duration, and error-rate alarms.\n' +
          '**Concurrency**: Monitor the concurrent execution widget below for peak usage.\n' +
          '**Cost Drivers**: Generate, Submit, Progress functions. Monitor Duration Sum for total compute time. **Est. Cost**: ~$0.20/1M requests (Lambda) + $3.50/1M API calls (API GW).',
      })
    );

    const lambdaTotalInvocations = new cloudwatch.MathExpression({
      expression: '(' + monitoredFunctions.map((_, i) => `inv${i}`).join(' + ') + ')',
      label: 'Total Lambda Invocations',
      period: cdk.Duration.hours(1),
      usingMetrics: Object.fromEntries(
        monitoredFunctions.map(({ fn }, i) => [
          `inv${i}`,
          fn.metricInvocations({ statistic: 'Sum', period: cdk.Duration.hours(1) }),
        ])
      ),
    });

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Lambda Invocations (Last Hour)',
        width: 8,
        height: 4,
        metrics: [lambdaTotalInvocations],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'API Requests (Last Hour)',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            dimensionsMap: { ApiName: api.restApiName, Stage: appEnv },
            label: 'API Count',
          }),
        ],
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Concurrent Execution Peak (Last Hour)',
        width: 8,
        height: 4,
        metrics: [
          new cloudwatch.MathExpression({
            expression: 'MAX([' + monitoredFunctions.map((_, i) => `conc${i}`).join(', ') + '])',
            label: 'Max Concurrent',
            period: cdk.Duration.hours(1),
            usingMetrics: Object.fromEntries(
              monitoredFunctions.map(({ fn }, i) => [
                `conc${i}`,
                new cloudwatch.Metric({
                  namespace: 'AWS/Lambda',
                  metricName: 'ConcurrentExecutions',
                  statistic: 'Maximum',
                  period: cdk.Duration.hours(1),
                  dimensionsMap: { FunctionName: fn.functionName },
                }),
              ])
            ),
          }),
        ],
      })
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Cost Analyzer: Total Duration by Function',
        width: 12,
        height: 6,
        logGroupNames: lambdaLogGroupNames,
        queryLines: costByFunctionQuery,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Cost Analyzer: Request Count + Latency by Endpoint',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: costByEndpointQuery,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: Top Errors by Function',
        width: 12,
        height: 6,
        logGroupNames: lambdaLogGroupNames,
        queryLines: topErrorsByFunctionQuery,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: Auth Failures by Route (401/403)',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: authFailuresByRouteQuery,
      })
    );

    dashboard.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: High-Latency Request Traces',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: highLatencyRequestTraceQuery,
      }),
      new cloudwatch.LogQueryWidget({
        title: 'Log Drilldown: 4XX/5XX Route Hotspots',
        width: 12,
        height: 6,
        logGroupNames: [apiAccessLogGroup.logGroupName],
        queryLines: routeHotspots4xx5xxQuery,
      })
    );
  }
}
