# Anthropic Request and Response (Learnfyra)

This document captures what Learnfyra sends to Anthropic and what Anthropic returns to Learnfyra during worksheet generation.

Source of truth in code:
- `src/ai/generator.js`
- `src/ai/promptBuilder.js`
- `src/ai/client.js`

## 1. What Learnfyra Requests From Anthropic

Learnfyra calls the Anthropic Messages API through the SDK:

```js
const message = await anthropic.messages.create(
  {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  },
  {
    timeout: anthropicRequestTimeoutMs,
  }
);
```

Runtime values used by this project:
- `CLAUDE_MODEL`: from env `CLAUDE_MODEL`, default `claude-sonnet-4-20250514`
- `MAX_TOKENS`: `8192`
- `timeout`: from env `ANTHROPIC_REQUEST_TIMEOUT_MS`
  - Lambda default: `22000`
  - Local default: `60000`

## 2. Complete Request Object (Concrete Example)

Example options used to build prompt:

```json
{
  "grade": 3,
  "subject": "Math",
  "topic": "Multiplication Facts (1-10)",
  "difficulty": "Medium",
  "questionCount": 10
}
```

With those options, this is the full request payload sent to Anthropic:

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 8192,
  "system": "You are an expert USA K-12 curriculum educator who creates high-quality, standards-aligned worksheets. You follow Common Core State Standards (CCSS) for Math and ELA, Next Generation Science Standards (NGSS) for Science, and C3 Framework standards for Social Studies. You ALWAYS return valid JSON only - no markdown fences, no preamble, no explanation text before or after the JSON object. Start your response with { and end it with }.",
  "messages": [
    {
      "role": "user",
      "content": "Generate a Medium difficulty worksheet for Grade 3 Math on the topic of \"Multiplication Facts (1-10)\".\n\nRequirements:\n- Produce EXACTLY 10 question objects in the \"questions\" array\n- Use only these question types: fill-in-the-blank, multiple-choice, true-false, word-problem, show-your-work\n- Align to standards: CCSS.MATH.CONTENT.3.OA.A.1, CCSS.MATH.CONTENT.3.OA.A.2, CCSS.MATH.CONTENT.3.OA.B.5, CCSS.MATH.CONTENT.3.OA.C.7, CCSS.MATH.CONTENT.3.NBT.A.1, CCSS.MATH.CONTENT.3.NBT.A.2, CCSS.MATH.CONTENT.3.NF.A.1, CCSS.MATH.CONTENT.3.NF.A.2, CCSS.MATH.CONTENT.3.MD.C.5, CCSS.MATH.CONTENT.3.MD.D.8\n- Write at early elementary (Grades 1-5) reading level\n- Include at least one word-problem question\n- Curriculum context: Grade 3 multiplication, division, fractions, area, and rounding.\n- Each multiple-choice question MUST have an \"options\" array of EXACTLY 4 strings labeled \"A. ...\", \"B. ...\", \"C. ...\", \"D. ...\"\n- Non-multiple-choice questions MUST NOT include an \"options\" field\n- Every question MUST include \"answer\" (string) and \"explanation\" (string)\n- \"number\" starts at 1 and increments by 1 for each question\n- \"totalPoints\" MUST equal the sum of all question \"points\" values\n- \"grade\" field MUST be the integer 3 (not a string)\n\nReturn ONLY a JSON object that matches this exact structure:\n{\n  \"title\": \"Grade 3 Math: Multiplication Facts\",\n  \"grade\": 3,\n  \"subject\": \"Math\",\n  \"topic\": \"Multiplication Facts (1-10)\",\n  \"difficulty\": \"Medium\",\n  \"standards\": [\"CCSS.MATH.CONTENT.3.OA.C.7\"],\n  \"estimatedTime\": \"20 minutes\",\n  \"instructions\": \"Solve each problem. Show your work where asked.\",\n  \"totalPoints\": 10,\n  \"questions\": [\n    {\n      \"number\": 1,\n      \"type\": \"fill-in-the-blank\",\n      \"question\": \"4 x 6 = ___\",\n      \"answer\": \"24\",\n      \"explanation\": \"4 groups of 6 equals 24.\",\n      \"points\": 1\n    },\n    {\n      \"number\": 2,\n      \"type\": \"multiple-choice\",\n      \"question\": \"What is 7 x 8?\",\n      \"options\": [\"A. 54\", \"B. 56\", \"C. 48\", \"D. 63\"],\n      \"answer\": \"B. 56\",\n      \"explanation\": \"7 times 8 equals 56.\",\n      \"points\": 1\n    },\n    {\n      \"number\": 3,\n      \"type\": \"word-problem\",\n      \"question\": \"A baker makes 6 trays with 8 cookies each. How many cookies total?\",\n      \"answer\": \"48\",\n      \"explanation\": \"6 x 8 = 48 cookies.\",\n      \"points\": 2\n    }\n  ]\n}"
    }
  ]
}
```

SDK call options sent alongside payload:

```json
{
  "timeout": 22000
}
```

Note: timeout above is the Lambda default. It can differ by environment variable.

## 3. What Anthropic Returns To Learnfyra

The code path currently reads these response fields:
- `message.stop_reason`
- `message.content[0].text`

Minimum response contract required by Learnfyra:

```json
{
  "stop_reason": "end_turn",
  "content": [
    {
      "text": "{ ...worksheet json... }"
    }
  ]
}
```

Typical successful response shape as consumed by Learnfyra:

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-20250514",
  "content": [
    {
      "type": "text",
      "text": "{\n  \"title\": \"Grade 3 Math Worksheet\",\n  \"grade\": 3,\n  \"subject\": \"Math\",\n  \"topic\": \"Multiplication Facts (1-10)\",\n  \"difficulty\": \"Medium\",\n  \"standards\": [\"CCSS.MATH.CONTENT.3.OA.C.7\"],\n  \"estimatedTime\": \"20 minutes\",\n  \"instructions\": \"Solve each problem.\",\n  \"totalPoints\": 10,\n  \"questions\": [\n    {\n      \"number\": 1,\n      \"type\": \"fill-in-the-blank\",\n      \"question\": \"4 x 6 = ___\",\n      \"answer\": \"24\",\n      \"explanation\": \"4 groups of 6 equals 24.\",\n      \"points\": 1\n    }\n  ]\n}"
    }
  ],
  "stop_reason": "end_turn"
}
```

## 4. How Learnfyra Processes Anthropic Response

After receiving response:
1. If `stop_reason === "max_tokens"`, treat as truncated and fail.
2. Read `content[0].text`.
3. Extract JSON object text (supports fenced or preamble text).
4. Parse JSON.
5. Coerce numeric fields (`grade`, `totalPoints`, `questions[].number`, `questions[].points`).
6. Validate required worksheet schema and exact question count.
7. Return validated worksheet object to generation pipeline.

## 5. Final Worksheet Object Learnfyra Expects After Validation

```json
{
  "title": "string",
  "grade": 3,
  "subject": "Math",
  "topic": "string",
  "difficulty": "Easy | Medium | Hard | Mixed",
  "instructions": "string",
  "totalPoints": 10,
  "questions": [
    {
      "number": 1,
      "type": "multiple-choice | fill-in-the-blank | short-answer | true-false | matching | show-your-work | word-problem",
      "question": "string",
      "answer": "string",
      "points": 1,
      "explanation": "string",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."]
    }
  ]
}
```

Notes:
- `options` is required only for `multiple-choice` and removed for non-multiple-choice.
- If Anthropic returns malformed JSON or schema mismatch, retry logic may trigger depending on `MAX_RETRIES`.