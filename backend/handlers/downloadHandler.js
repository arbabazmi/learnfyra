/**
 * @file backend/handlers/downloadHandler.js
 * @description Lambda handler — GET /api/download?key=<S3_KEY>
 *
 * Generates a presigned S3 GET URL valid for 1 hour and returns it.
 * The frontend opens this URL in a new tab to trigger the browser download.
 */

import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

let _s3;
function getS3() { if (!_s3) _s3 = new S3Client({}); return _s3; }
function getBucket() { return process.env.WORKSHEET_BUCKET_NAME; }

const URL_EXPIRY_SECONDS = 3600; // 1 hour

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const s3Key = event.queryStringParameters?.key;

  if (!s3Key || typeof s3Key !== 'string' || !s3Key.trim()) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required query parameter: key' }),
    };
  }

  try {
    // Verify the object exists before generating the presigned URL
    await getS3().send(new HeadObjectCommand({ Bucket: getBucket(), Key: s3Key }));
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'File not found or has expired.' }),
      };
    }
    console.error('downloadHandler HeadObject error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Could not verify file. Please try again.' }),
    };
  }

  try {
    const command = new GetObjectCommand({ Bucket: getBucket(), Key: s3Key });
    const downloadUrl = await getSignedUrl(getS3(), command, { expiresIn: URL_EXPIRY_SECONDS });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ downloadUrl }),
    };
  } catch (err) {
    console.error('downloadHandler presign error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Could not generate download link. Please try again.' }),
    };
  }
};
