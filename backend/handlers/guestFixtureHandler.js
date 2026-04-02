/**
 * @file backend/handlers/guestFixtureHandler.js
 * @description Lambda handler — GET /api/guest/preview?role=teacher|parent
 *
 * Returns hardcoded fixture JSON for Guest Teacher and Guest Parent role
 * previews. Zero DynamoDB reads. No auth required (public endpoint).
 *
 * - ?role=teacher → 200 with sample class/student data
 * - ?role=parent  → 200 with sample child progress data
 * - ?role=student → 403 (students get real data, not fixtures)
 * - missing/invalid role → 400
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const FIXTURES = {
  teacher: {
    _note: 'Sample data — login to see your real classes',
    classes: [
      { classId: 'sample-1', name: 'Grade 4 Math', studentCount: 24, activeThisWeek: 18 },
      { classId: 'sample-2', name: 'Grade 5 Science', studentCount: 21, activeThisWeek: 15 },
    ],
    recentStudents: [
      { name: 'Alex M.', lastActive: '2 hours ago', weeklyScore: 84 },
      { name: 'Jordan P.', lastActive: 'Yesterday', weeklyScore: 71 },
      { name: 'Casey T.', lastActive: '3 days ago', weeklyScore: 93 },
    ],
    topWeakTopics: [
      { topic: 'Fractions', avgAccuracy: 52, studentsAffected: 9 },
      { topic: 'Long Division', avgAccuracy: 61, studentsAffected: 7 },
    ],
  },
  parent: {
    _note: 'Sample data — login to see your child\'s real progress',
    children: [{ name: 'Sample Child', grade: 4, school: 'Lincoln Elementary' }],
    recentActivity: [
      { date: 'Today', worksheet: 'Multiplication Practice', score: 88, duration: '12 min' },
      { date: 'Yesterday', worksheet: 'Reading Comprehension', score: 74, duration: '18 min' },
    ],
    weeklyProgress: {
      worksheetsCompleted: 3,
      averageScore: 81,
      timeSpent: '42 min',
      strongestTopic: 'Geometry',
      weakestTopic: 'Fractions',
    },
  },
};

/**
 * Lambda handler — GET /api/guest/preview
 *
 * @param {Object} event - API Gateway event
 * @param {Object} context - Lambda context
 * @returns {Promise<{ statusCode: number, headers: Object, body: string }>}
 */
export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const role = event.queryStringParameters?.role;

  if (!role) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'role query parameter is required. Use ?role=teacher or ?role=parent.' }),
    };
  }

  if (role === 'student') {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Students access real data, not fixture previews.' }),
    };
  }

  const fixture = FIXTURES[role];
  if (!fixture) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Invalid role "${role}". Use ?role=teacher or ?role=parent.` }),
    };
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
    body: JSON.stringify(fixture),
  };
};
