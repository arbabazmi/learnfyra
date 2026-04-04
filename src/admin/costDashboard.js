/**
 * @file src/admin/costDashboard.js
 * @description Aggregates GenerationLog data for the AI cost dashboard.
 * Query-time computation — no pre-aggregated tables.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

let _docClient = null;
function getDocClient() {
  if (!_docClient) {
    const config = { region: process.env.AWS_REGION || 'us-east-1' };
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    if (endpoint) {
      config.endpoint = endpoint;
      config.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
    }
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

function getGenLogTable() {
  return process.env.GENLOG_TABLE_NAME || `LearnfyraGenerationLog-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;
}

function getConfigTable() {
  return process.env.CONFIG_TABLE_NAME || `LearnfyraConfig-${process.env.DYNAMO_ENV || process.env.NODE_ENV || 'local'}`;
}

/**
 * Calculates the cutoff timestamp for a time window.
 * @param {'24h'|'7d'|'30d'} window
 * @returns {string} ISO-8601 cutoff
 */
function getCutoff(window) {
  const now = Date.now();
  const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[window];
  if (!ms) throw new Error(`Invalid window: ${window}`);
  return new Date(now - ms).toISOString();
}

/**
 * Fetches model pricing from Config table.
 * @returns {Promise<Map<string, number>>} model -> cost per 1M tokens
 */
async function getModelPricing() {
  const pricing = new Map();
  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: getConfigTable(),
      Key: { configKey: 'ai/modelPricing' },
    }));
    if (result.Item?.value) {
      const parsed = typeof result.Item.value === 'string'
        ? JSON.parse(result.Item.value)
        : result.Item.value;
      for (const [model, cost] of Object.entries(parsed)) {
        pricing.set(model, Number(cost));
      }
    }
  } catch (err) {
    console.error('Failed to load model pricing:', err.message);
  }
  return pricing;
}

/**
 * Gets cost dashboard data for a time window.
 *
 * @param {'24h'|'7d'|'30d'} window
 * @returns {Promise<Object>} Dashboard data
 */
export async function getCostDashboard(window) {
  const cutoff = getCutoff(window);
  const client = getDocClient();
  const pricing = await getModelPricing();

  const records = [];
  let lastKey;

  do {
    const result = await client.send(new ScanCommand({
      TableName: getGenLogTable(),
      FilterExpression: 'createdAt >= :cutoff',
      ExpressionAttributeValues: { ':cutoff': cutoff },
      ExclusiveStartKey: lastKey,
    }));
    records.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  // Aggregate
  let totalTokens = 0;
  let successCount = 0;
  let failureCount = 0;
  let retryCount = 0;
  const byModel = {};
  const bySubjectGrade = {};

  for (const r of records) {
    const tokens = r.totalTokens || r.tokensUsed || 0;
    totalTokens += tokens;

    const model = r.model || r.modelId || 'unknown';
    if (!byModel[model]) byModel[model] = { tokens: 0, count: 0 };
    byModel[model].tokens += tokens;
    byModel[model].count++;

    const key = `${r.subject || 'unknown'}|${r.grade || 'unknown'}`;
    if (!bySubjectGrade[key]) bySubjectGrade[key] = { tokens: 0, count: 0 };
    bySubjectGrade[key].tokens += tokens;
    bySubjectGrade[key].count++;

    if (r.status === 'success' || r.status === 'completed') successCount++;
    else if (r.status === 'failed' || r.status === 'error') failureCount++;
    if (r.retryCount > 0) retryCount++;
  }

  const total = records.length || 1;
  const costEstimateByModel = Object.entries(byModel).map(([model, data]) => {
    const costPer1M = pricing.get(model);
    return {
      model,
      tokens: data.tokens,
      count: data.count,
      estimatedCost: costPer1M != null ? (data.tokens / 1_000_000) * costPer1M : null,
      currency: costPer1M != null ? 'USD' : null,
    };
  });

  const avgTokensBySubjectAndGrade = Object.entries(bySubjectGrade).map(([key, data]) => {
    const [subject, grade] = key.split('|');
    return { subject, grade, avgTokens: Math.round(data.tokens / data.count) };
  });

  return {
    window,
    totalTokens,
    totalGenerations: records.length,
    costEstimateByModel,
    avgTokensBySubjectAndGrade,
    successRate: Math.round((successCount / total) * 100),
    failureRate: Math.round((failureCount / total) * 100),
    retryRate: Math.round((retryCount / total) * 100),
  };
}

/**
 * Returns top 10 most expensive generation requests in last 30 days.
 * @returns {Promise<Array>}
 */
export async function getTopExpensiveRequests() {
  const cutoff = getCutoff('30d');
  const client = getDocClient();
  const records = [];
  let lastKey;

  do {
    const result = await client.send(new ScanCommand({
      TableName: getGenLogTable(),
      FilterExpression: 'createdAt >= :cutoff',
      ExpressionAttributeValues: { ':cutoff': cutoff },
      ExclusiveStartKey: lastKey,
    }));
    records.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  records.sort((a, b) => (b.totalTokens || b.tokensUsed || 0) - (a.totalTokens || a.tokensUsed || 0));
  return records.slice(0, 10);
}

/**
 * Checks if rolling 24h token usage exceeds daily budget ceiling.
 * Fail-open: returns false (not exceeded) if Config read fails.
 *
 * @returns {Promise<{exceeded: boolean, currentUsage: number, ceiling: number|null}>}
 */
export async function checkDailyBudget() {
  try {
    const client = getDocClient();
    const configResult = await client.send(new GetCommand({
      TableName: getConfigTable(),
      Key: { configKey: 'DAILY_TOKEN_BUDGET' },
    }));

    const ceiling = configResult.Item?.value ? Number(configResult.Item.value) : null;
    if (ceiling == null) return { exceeded: false, currentUsage: 0, ceiling: null };

    const cutoff = getCutoff('24h');
    let totalTokens = 0;
    let lastKey;

    do {
      const result = await client.send(new ScanCommand({
        TableName: getGenLogTable(),
        FilterExpression: 'createdAt >= :cutoff',
        ExpressionAttributeValues: { ':cutoff': cutoff },
        ProjectionExpression: 'totalTokens, tokensUsed',
        ExclusiveStartKey: lastKey,
      }));
      for (const item of (result.Items || [])) {
        totalTokens += item.totalTokens || item.tokensUsed || 0;
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return { exceeded: totalTokens >= ceiling, currentUsage: totalTokens, ceiling };
  } catch (err) {
    console.error('checkDailyBudget failed (fail-open):', err.message);
    return { exceeded: false, currentUsage: 0, ceiling: null };
  }
}
