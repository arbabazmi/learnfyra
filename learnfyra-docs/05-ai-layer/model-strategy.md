# AI Model Strategy

## Overview

Learnfyra uses Anthropic Claude as the sole AI provider for Phase 1. The active model is configurable at runtime via the M07 Admin Control Plane — switching models does not require a Lambda redeploy.

## Model Catalog

| Model ID | Provider | Use Case | Cost Tier | Phase |
|---|---|---|---|---|
| `claude-sonnet-4-20250514` | Anthropic | Default generation | Medium | Phase 1 |
| `claude-haiku-20240307` | Anthropic | Cost-optimized fallback | Low | Phase 1 |
| `claude-opus-*` | Anthropic | High-quality curriculum verification | High | Phase 1 (admin-activated only) |

## Default Model Parameters

These are the default parameters used in all Claude API calls. They can be overridden via DynamoDB Config table (`ai/maxTokens`, `ai/temperature`).

```javascript
{
  model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  max_tokens: 8192,
  temperature: 0.7,
  system: buildSystemPrompt(),
  messages: [{ role: 'user', content: buildUserPrompt(options) }]
}
```

**MAX_TOKENS = 8192:** Supports up to 30 questions with full explanations. Most worksheets are 1000–3000 tokens. The 8192 limit provides headroom for complex topics and show-your-work questions.

**temperature = 0.7:** Balances creativity (varied question phrasing) with predictability (correct answers, consistent format). Lower temperatures (0.3–0.5) reduce creativity but improve JSON structure compliance.

## Anthropic API Call Pattern

```javascript
// From src/ai/client.js
import Anthropic from '@anthropic-ai/sdk';

// Lazy proxy — does NOT throw at import time
let _client;
const getAnthropicClient = () => {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
};

// From src/ai/generator.js
const response = await withRetry(async () => {
  const client = getAnthropicClient();
  return await client.messages.create({
    model: activeModel,        // read from Config table at runtime
    max_tokens: 8192,
    messages: [
      { role: 'user', content: userPrompt }
    ],
    system: systemPrompt
  });
}, { maxRetries: 3, baseDelayMs: 1000 });
```

## Runtime Model Selection

The active model is read from DynamoDB Config table on each generation request:

```javascript
// In generateHandler.js
const activeModel = await getConfig('ai/activeModel')
  ?? process.env.CLAUDE_MODEL
  ?? 'claude-sonnet-4-20250514';
```

This 3-level fallback ensures the handler works:
1. When DynamoDB Config table has a model override
2. When the env var is set (CDK-injected default)
3. When neither is set (hardcoded last-resort fallback)

## Retry Strategy

Claude API calls use the `withRetry` utility with:
- `maxRetries: 3`
- `baseDelayMs: 1000` (exponential backoff: 1s, 2s, 4s)
- Retry condition: any non-4xx error (network failures, 5xx from Anthropic)
- **Strict prompt escalation:** On attempt >= 1, `buildStrictUserPrompt()` is used instead of `buildUserPrompt()`. The strict prompt adds a CRITICAL prefix emphasizing exact JSON format compliance.

## Truncation & Refusal Detection

After each Claude API call, the generator checks:

```javascript
// Detect max_tokens truncation
if (response.stop_reason === 'max_tokens') {
  throw new Error('Response truncated — reduce questionCount or increase max_tokens');
}

// Detect safety refusals
if (response.content[0].text.includes("I can't create") ||
    response.content[0].text.includes("I'm unable to")) {
  throw new Error('Claude safety refusal — adjust prompt or topic');
}
```

## JSON Extraction & Validation

Claude's response is raw text, not guaranteed valid JSON. The extraction pipeline:

1. `extractJSON(rawText)`: finds the JSON block using regex `/{[\s\S]*}/` or markdown code fence detection
2. `JSON.parse()`: throws if malformed
3. `coerceTypes(data)`: converts string "3" to number 3, normalizes boolean-like strings
4. `validateTopLevel(data)`: checks required fields (title, grade, subject, questions array)
5. `validateQuestions(data.questions)`: checks each question has required fields, correct type enum, options only on multiple-choice

On validation failure → retry with strict prompt.

## Model Hot-Swap (M07 Admin Feature)

An Ops Admin can switch the active model without redeploy:

1. Admin calls `PUT /api/admin/models/{modelId}/activate`
2. Handler writes new `ai/activeModel` config to DynamoDB
3. All Lambda invocations after this point read the new model from DynamoDB
4. In-flight requests use the previous model (container-cached value, max 60s TTL)
5. Model switch is logged to audit trail in Config table

**Rollback:** `POST /api/admin/models/rollback` restores the most recent previous model from the audit log.

## Phase 2 — Multi-Provider Support

Phase 2 will add OpenAI and Google Gemini as alternative providers via a provider abstraction layer:

```javascript
// Planned interface (Phase 2)
const generateWithModel = async (modelConfig, prompt) => {
  switch (modelConfig.provider) {
    case 'anthropic': return anthropicProvider.generate(modelConfig, prompt);
    case 'openai':    return openaiProvider.generate(modelConfig, prompt);
    case 'google':    return googleProvider.generate(modelConfig, prompt);
  }
};
```

Phase 1 code (`src/ai/client.js`) should be structured to make this abstraction easy to add without breaking existing calls.

## Cost Estimation

Based on claude-sonnet-4-20250514 pricing (as of early 2026):

| Scenario | Input Tokens | Output Tokens | Estimated Cost |
|---|---|---|---|
| 10-question worksheet | ~800 | ~1500 | ~$0.017 |
| 30-question worksheet | ~800 | ~4000 | ~$0.042 |
| Mixed bank+AI (5 AI questions) | ~800 | ~750 | ~$0.010 |

Bank-first assembly significantly reduces AI cost for repeat topic combinations. A fully bank-served worksheet costs $0 in Claude API fees.

Monthly cost estimates:
- 1000 full AI generations/day: ~$510/month (Sonnet)
- 1000 full AI generations/day: ~$51/month (Haiku fallback)
- 1000 mixed generations/day (50% bank-served): ~$255/month
