/**
 * @file backend/handlers/submitHandler.js
 * @description Lambda-compatible handler for POST /api/submit.
 * Reads the stored worksheet data, scores the student answers, and returns
 * a full per-question result breakdown.
 *
 * Local dev:  reads worksheets-local/{worksheetId}/solve-data.json
 * Lambda/AWS: reads from DynamoDB (WORKSHEETS_TABLE_NAME env var).
 *             Submit always receives a UUID - slug lookup is not needed here.
 */

import { promises as fs } from "fs";
import path, { join, resolve } from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// __dirname is not available in Lambda CJS bundle; use process.cwd() for root
const __dirname = process.cwd();

const isAws = process.env.APP_RUNTIME === "aws";

let _dynamo, _docClient;
function getDocClient() {
  if (!_docClient) {
    _dynamo = new DynamoDBClient({});
    _docClient = DynamoDBDocumentClient.from(_dynamo);
  }
  return _docClient;
}

async function fetchFromDynamo(worksheetId) {
  const tableName = process.env.WORKSHEETS_TABLE_NAME;
  if (!tableName) {
    const e = new Error("WORKSHEETS_TABLE_NAME not set.");
    e.statusCode = 500;
    throw e;
  }
  const res = await getDocClient().send(new GetCommand({
    TableName: tableName,
    Key: { worksheetId },
  }));
  if (!res.Item) {
    const e = new Error("Worksheet not found.");
    e.statusCode = 404;
    throw e;
  }
  return res.Item;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const WORKSHEET_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateAnswersArray(answers) {
  const seenNumbers = new Set();
  for (const entry of answers) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return "Each answers entry must be an object.";
    }
    const number = Number(entry.number);
    if (!Number.isInteger(number) || number < 1) {
      return "Each answers entry must include a positive integer number.";
    }
    if (seenNumbers.has(number)) {
      return "answers must not contain duplicate question numbers.";
    }
    seenNumbers.add(number);
  }
  return null;
}

function isWithinBaseDir(baseDir, childPath) {
  const rel = path.relative(baseDir, childPath);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

let _buildResult;
async function getBuildResult() {
  if (!_buildResult) {
    const mod = await import("../../src/solve/resultBuilder.js");
    _buildResult = mod.buildResult;
  }
  return _buildResult;
}

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON in request body.", code: "SUBMIT_INVALID_REQUEST" }),
      };
    }

    const { worksheetId, answers, timeTaken, timed } = body;
    const studentName = typeof body.studentName === "string" ? body.studentName.trim().slice(0, 100) : "";

    if (!worksheetId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "worksheetId is required.", code: "SUBMIT_INVALID_REQUEST" }) };
    }
    if (!WORKSHEET_ID_REGEX.test(worksheetId)) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid worksheetId format.", code: "SUBMIT_INVALID_REQUEST" }) };
    }
    if (!Array.isArray(answers)) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "answers must be an array.", code: "SUBMIT_INVALID_REQUEST" }) };
    }
    const answersValidationError = validateAnswersArray(answers);
    if (answersValidationError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: answersValidationError, code: "SUBMIT_INVALID_REQUEST" }) };
    }

    let worksheet;
    if (isAws) {
      try {
        worksheet = await fetchFromDynamo(worksheetId);
      } catch (dbErr) {
        return { statusCode: dbErr.statusCode || 404, headers: corsHeaders, body: JSON.stringify({ error: dbErr.message || "Worksheet not found.", code: "SUBMIT_NOT_FOUND" }) };
      }
    } else {
      const baseDir = resolve(join(__dirname, "worksheets-local"));
      const localDir = resolve(join(baseDir, worksheetId));
      if (!isWithinBaseDir(baseDir, localDir)) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid worksheetId format.", code: "SUBMIT_INVALID_REQUEST" }) };
      }
      const filePath = join(localDir, "solve-data.json");
      try {
        worksheet = JSON.parse(await fs.readFile(filePath, "utf8"));
      } catch {
        return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Worksheet not found.", code: "SUBMIT_NOT_FOUND" }) };
      }
    }

    const buildResult = await getBuildResult();
    const result = buildResult(
      worksheet,
      answers,
      typeof timeTaken === "number" && isFinite(timeTaken) ? Math.max(0, timeTaken) : 0,
      Boolean(timed),
    );
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
  } catch (err) {
    console.error("submitHandler error:", err);
    const isDebug = process.env.DEBUG_MODE === "true";
    const submitBody = { error: isDebug ? err.message : "Internal server error.", code: "SUBMIT_INTERNAL_ERROR" };
    if (isDebug) {
      submitBody._debug = { stack: err.stack, handler: "submitHandler", statusCode: 500, timestamp: new Date().toISOString() };
    }
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify(submitBody) };
  }
};
