param(
  [string]$BaseUrl = 'http://localhost:3000',
  [int]$TimeoutSec = 120,
  [string]$AdminToken = '',
  [string]$StudentToken = '',
  [string]$TeacherToken = '',
  [string]$ParentToken = '',
  [string]$StudentId = '',
  [string]$TeacherId = '',
  [string]$ParentId = '',
  [switch]$SkipAuthFlow,
  [switch]$IncludeOptional
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$results = New-Object System.Collections.Generic.List[object]
$ctx = @{
  StudentToken              = $null
  TeacherToken              = $null
  ParentToken               = $null
  StudentId                 = $null
  TeacherId                 = $null
  ParentId                  = $null
  WorksheetId               = $null
  ClassId                   = $null
  InviteCode                = $null
  QuestionId                = $null
  CertificateId             = $null
  CertificateDownloadToken  = $null
}

if (-not [string]::IsNullOrWhiteSpace($StudentToken)) { $ctx.StudentToken = $StudentToken }
if (-not [string]::IsNullOrWhiteSpace($TeacherToken)) { $ctx.TeacherToken = $TeacherToken }
if (-not [string]::IsNullOrWhiteSpace($ParentToken))  { $ctx.ParentToken  = $ParentToken  }
if (-not [string]::IsNullOrWhiteSpace($StudentId))    { $ctx.StudentId    = $StudentId    }
if (-not [string]::IsNullOrWhiteSpace($TeacherId))    { $ctx.TeacherId    = $TeacherId    }
if (-not [string]::IsNullOrWhiteSpace($ParentId))     { $ctx.ParentId     = $ParentId     }

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Get-ResponseBodyFromException {
  param([System.Exception]$Exception)
  $statusCode = -1
  $bodyText   = ''
  if ($Exception.PSObject.Properties.Match('Response').Count -gt 0 -and $Exception.Response) {
    try   { $statusCode = [int]$Exception.Response.StatusCode } catch { $statusCode = -1 }
    try {
      $stream = $Exception.Response.GetResponseStream()
      if ($stream) {
        $reader   = New-Object System.IO.StreamReader($stream)
        $bodyText = $reader.ReadToEnd()
        $reader.Dispose()
      }
    } catch { if (-not $bodyText) { $bodyText = $Exception.Message } }
  } else { $bodyText = $Exception.Message }
  return [pscustomobject]@{ StatusCode = $statusCode; BodyText = $bodyText }
}

function Try-ParseJson {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  try   { return $Text | ConvertFrom-Json -ErrorAction Stop }
  catch { return $null }
}

function Invoke-ApiTest {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PUT', 'DELETE')][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [hashtable]$Headers        = @{},
    [object]$Body              = $null,
    [int[]]$ExpectedStatus     = @(200),
    [scriptblock]$OnSuccess    = $null,
    [switch]$Skip
  )

  if ($Skip) {
    $results.Add([pscustomobject]@{
      Name       = $Name; Method = $Method; Path = $Path
      StatusCode = 'SKIP'; Expected = ($ExpectedStatus -join ',')
      Result     = 'SKIP'; Error = 'Skipped by condition'
    }) | Out-Null
    return
  }

  $uri      = "$BaseUrl$Path"
  $jsonBody = $null
  if ($null -ne $Body) {
    $jsonBody = $Body | ConvertTo-Json -Depth 20
    if (-not $Headers.ContainsKey('Content-Type')) { $Headers['Content-Type'] = 'application/json' }
  }

  $statusCode = -1; $bodyText = ''; $parsed = $null
  try {
    $invokeParams = @{
      Uri = $uri; Method = $Method; Headers = $Headers
      TimeoutSec = $TimeoutSec; UseBasicParsing = $true
    }
    if ($null -ne $jsonBody) { $invokeParams['Body'] = $jsonBody }
    $response   = Invoke-WebRequest @invokeParams
    $statusCode = [int]$response.StatusCode
    $bodyText   = $response.Content
    $parsed     = Try-ParseJson -Text $bodyText
  } catch {
    $errInfo    = Get-ResponseBodyFromException -Exception $_.Exception
    $statusCode = $errInfo.StatusCode
    $bodyText   = $errInfo.BodyText
    $parsed     = Try-ParseJson -Text $bodyText
  }

  $passed    = $ExpectedStatus -contains $statusCode
  $errorText = ''
  if (-not $passed) {
    if ($parsed -and $parsed.error) {
      $errorText = [string]$parsed.error
      if ($parsed.code) { $errorText = "$errorText (code: $($parsed.code))" }
    } elseif ($bodyText) {
      $errorText = ($bodyText -replace '\s+', ' ').Trim()
      if ($errorText.Length -gt 240) { $errorText = $errorText.Substring(0, 240) + '...' }
    } else { $errorText = 'No response body' }
  }

  $results.Add([pscustomobject]@{
    Name       = $Name; Method = $Method; Path = $Path
    StatusCode = $statusCode; Expected = ($ExpectedStatus -join ',')
    Result     = if ($passed) { 'PASS' } else { 'FAIL' }
    Error      = $errorText
  }) | Out-Null

  if ($passed -and $OnSuccess) { & $OnSuccess $parsed $statusCode }
}

# ─── Setup ────────────────────────────────────────────────────────────────────

Write-Host "Testing Learnfyra APIs at $BaseUrl" -ForegroundColor Cyan
Write-Host 'Tip: ensure local server is running: npm run dev' -ForegroundColor DarkGray

$runId        = Get-Date -Format 'yyyyMMddHHmmss'
$studentEmail = "student.$runId@example.com"
$teacherEmail = "teacher.$runId@example.com"
$parentEmail  = "parent.$runId@example.com"
$password     = 'Passw0rd123!'

# ─── 1) Auth flow ────────────────────────────────────────────────────────────

Invoke-ApiTest -Name 'Auth Register Student' -Method 'POST' -Path '/api/auth/register' -ExpectedStatus @(200,409) -Skip:$SkipAuthFlow -Body @{
  email = $studentEmail; password = $password; role = 'student'; displayName = 'API Test Student'
}
Invoke-ApiTest -Name 'Auth Register Teacher' -Method 'POST' -Path '/api/auth/register' -ExpectedStatus @(200,409) -Skip:$SkipAuthFlow -Body @{
  email = $teacherEmail; password = $password; role = 'teacher'; displayName = 'API Test Teacher'
}
Invoke-ApiTest -Name 'Auth Register Parent'  -Method 'POST' -Path '/api/auth/register' -ExpectedStatus @(200,409) -Skip:$SkipAuthFlow -Body @{
  email = $parentEmail;  password = $password; role = 'parent';  displayName = 'API Test Parent'
}

Invoke-ApiTest -Name 'Auth Login Student' -Method 'POST' -Path '/api/auth/login' -ExpectedStatus @(200) -Skip:$SkipAuthFlow -Body @{
  email = $studentEmail; password = $password
} -OnSuccess {
  param($json)
  if ($json -and $json.token)  { $ctx.StudentToken = [string]$json.token }
  if ($json -and $json.userId) { $ctx.StudentId    = [string]$json.userId }
}
Invoke-ApiTest -Name 'Auth Login Teacher' -Method 'POST' -Path '/api/auth/login' -ExpectedStatus @(200) -Skip:$SkipAuthFlow -Body @{
  email = $teacherEmail; password = $password
} -OnSuccess {
  param($json)
  if ($json -and $json.token)  { $ctx.TeacherToken = [string]$json.token }
  if ($json -and $json.userId) { $ctx.TeacherId    = [string]$json.userId }
}
Invoke-ApiTest -Name 'Auth Login Parent'  -Method 'POST' -Path '/api/auth/login' -ExpectedStatus @(200) -Skip:$SkipAuthFlow -Body @{
  email = $parentEmail; password = $password
} -OnSuccess {
  param($json)
  if ($json -and $json.token)  { $ctx.ParentToken = [string]$json.token }
  if ($json -and $json.userId) { $ctx.ParentId    = [string]$json.userId }
}

Invoke-ApiTest -Name 'Auth Logout'               -Method 'POST' -Path '/api/auth/logout'              -ExpectedStatus @(200) -Skip:$SkipAuthFlow -Body @{}
Invoke-ApiTest -Name 'Auth OAuth Initiate Google' -Method 'POST' -Path '/api/auth/oauth/google'        -ExpectedStatus @(200) -Skip:$SkipAuthFlow -Body @{}
Invoke-ApiTest -Name 'Auth OAuth Callback Google' -Method 'GET'  -Path '/api/auth/callback/google?code=local-test-code&state=local-test-state' -ExpectedStatus @(200) -Skip:$SkipAuthFlow

# ─── Token / skip guards ──────────────────────────────────────────────────────

$defaultProtectedHeaders = @{}
if ($ctx.TeacherToken)      { $defaultProtectedHeaders['Authorization'] = "Bearer $($ctx.TeacherToken)" }
elseif ($ctx.StudentToken)  { $defaultProtectedHeaders['Authorization'] = "Bearer $($ctx.StudentToken)" }
$missingProtectedToken = ($defaultProtectedHeaders.Count -eq 0)

$studentAuthHeaders = @{}
if ($ctx.StudentToken) { $studentAuthHeaders['Authorization'] = "Bearer $($ctx.StudentToken)" }
$teacherAuthHeaders = @{}
if ($ctx.TeacherToken) { $teacherAuthHeaders['Authorization'] = "Bearer $($ctx.TeacherToken)" }
$parentAuthHeaders = @{}
if ($ctx.ParentToken) { $parentAuthHeaders['Authorization'] = "Bearer $($ctx.ParentToken)" }

# ─── 2) Worksheet generate → solve → submit → download ───────────────────────

# 2a. Generate worksheet (HTML, with answer key, all optional student/class fields)
Invoke-ApiTest -Name 'Worksheet Generate' -Method 'POST' -Path '/api/generate' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade            = 4
    subject          = 'Math'
    topic            = 'Factors and Multiples'
    difficulty       = 'Easy'
    questionCount    = 10
    format           = 'HTML'
    includeAnswerKey = $true
    studentName      = 'API Test Student'
    teacherName      = 'API Test Teacher'
    period           = 'Period 1'
    className        = 'API Smoke Class'
  } -OnSuccess {
    param($json)
    if ($json -and $json.metadata -and $json.metadata.id) {
      $ctx.WorksheetId = [string]$json.metadata.id
    } elseif ($json -and $json.worksheetId) {
      $ctx.WorksheetId = [string]$json.worksheetId
    }
  }

# 2b. GET /api/solve/:id — must return questions only (no answers field on each question)
Invoke-ApiTest -Name 'Worksheet Solve' -Method 'GET' -Path "/api/solve/$($ctx.WorksheetId)" `
  -ExpectedStatus @(200) -Headers $defaultProtectedHeaders `
  -Skip:($missingProtectedToken -or [string]::IsNullOrWhiteSpace($ctx.WorksheetId))

# 2c. POST /api/submit — partial answers allowed; matches CLAUDE.md submit request schema
$submitAnswers = @(
  @{ number = 1; answer = 'A'    },
  @{ number = 2; answer = 'True' },
  @{ number = 3; answer = '42'   },
  @{ number = 4; answer = 'B'    },
  @{ number = 5; answer = 'False'},
  @{ number = 6; answer = 'Paris'},
  @{ number = 7; answer = 'C'    },
  @{ number = 8; answer = '100'  },
  @{ number = 9; answer = 'True' },
  @{ number = 10; answer = '30'  }
)
Invoke-ApiTest -Name 'Worksheet Submit' -Method 'POST' -Path '/api/submit' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders `
  -Skip:($missingProtectedToken -or [string]::IsNullOrWhiteSpace($ctx.WorksheetId)) -Body @{
    worksheetId = $ctx.WorksheetId
    studentName = 'API Test Student'
    answers     = $submitAnswers
    timeTaken   = 480
    timed       = $false
  }

# 2d. Download the generated HTML file
Invoke-ApiTest -Name 'Worksheet Download' -Method 'GET' `
  -Path "/api/download?key=local/$($ctx.WorksheetId)/worksheet.html" -ExpectedStatus @(200) `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.WorksheetId))

# ─── 3) NEW — POST /api/generate-questions (M08 LLM routing pipeline) ────────
#   Valid questionType values: multiple-choice | true-false | fill-in-the-blank |
#                              short-answer | word-problem | show-your-work
#   count: 1–30 (integer)
#   difficulty: Easy | Medium | Hard | Mixed

Invoke-ApiTest -Name 'GenerateQuestions (multiple-choice Easy)' -Method 'POST' `
  -Path '/api/generate-questions' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade        = 4
    subject      = 'Math'
    topic        = 'Factors and Multiples'
    difficulty   = 'Easy'
    questionType = 'multiple-choice'
    count        = 3
  }

Invoke-ApiTest -Name 'GenerateQuestions (true-false Medium)' -Method 'POST' `
  -Path '/api/generate-questions' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade        = 5
    subject      = 'Science'
    topic        = 'Ecosystems'
    difficulty   = 'Medium'
    questionType = 'true-false'
    count        = 2
  }

Invoke-ApiTest -Name 'GenerateQuestions (short-answer Hard)' -Method 'POST' `
  -Path '/api/generate-questions' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade        = 7
    subject      = 'ELA'
    topic        = 'Literary Devices'
    difficulty   = 'Hard'
    questionType = 'short-answer'
    count        = 2
  }

Invoke-ApiTest -Name 'GenerateQuestions (Mixed difficulty)' -Method 'POST' `
  -Path '/api/generate-questions' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade        = 3
    subject      = 'Math'
    topic        = 'Addition and Subtraction'
    difficulty   = 'Mixed'
    questionType = 'fill-in-the-blank'
    count        = 3
  }

# Validation error: grade out of range
Invoke-ApiTest -Name 'GenerateQuestions (400 invalid grade)' -Method 'POST' `
  -Path '/api/generate-questions' -ExpectedStatus @(400) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade        = 11
    subject      = 'Math'
    topic        = 'Algebra'
    difficulty   = 'Easy'
    questionType = 'multiple-choice'
    count        = 3
  }

# Validation error: unknown questionType
Invoke-ApiTest -Name 'GenerateQuestions (400 invalid questionType)' -Method 'POST' `
  -Path '/api/generate-questions' -ExpectedStatus @(400) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade        = 4
    subject      = 'Math'
    topic        = 'Fractions'
    difficulty   = 'Easy'
    questionType = 'essay'
    count        = 3
  }

# ─── 4) Student + teacher class flow ──────────────────────────────────────────

Invoke-ApiTest -Name 'Student Profile' -Method 'GET' -Path '/api/student/profile' -ExpectedStatus @(200) `
  -Headers $studentAuthHeaders -Skip:([string]::IsNullOrWhiteSpace($ctx.StudentToken))

Invoke-ApiTest -Name 'Class Create' -Method 'POST' -Path '/api/class/create' -ExpectedStatus @(201) `
  -Headers $teacherAuthHeaders -Skip:([string]::IsNullOrWhiteSpace($ctx.TeacherToken)) -Body @{
    className = "API Class $runId"
    grade     = 4
    subject   = 'Math'
  } -OnSuccess {
    param($json)
    if ($json -and $json.classId)    { $ctx.ClassId    = [string]$json.classId    }
    if ($json -and $json.inviteCode) { $ctx.InviteCode = [string]$json.inviteCode }
  }

Invoke-ApiTest -Name 'Class Students List' -Method 'GET' -Path "/api/class/$($ctx.ClassId)/students" `
  -ExpectedStatus @(200) -Headers $teacherAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.ClassId) -or [string]::IsNullOrWhiteSpace($ctx.TeacherToken))

Invoke-ApiTest -Name 'Student Join Class' -Method 'POST' -Path '/api/student/join-class' `
  -ExpectedStatus @(200,409) -Headers $studentAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.InviteCode) -or [string]::IsNullOrWhiteSpace($ctx.StudentToken)) -Body @{
    inviteCode = $ctx.InviteCode
  }

# ─── 5) Progress routes ───────────────────────────────────────────────────────

$progressPayload = @{
  worksheetId  = $ctx.WorksheetId
  grade        = 4
  subject      = 'Math'
  topic        = 'Factors and Multiples'
  difficulty   = 'Easy'
  classId      = $ctx.ClassId
  totalScore   = 8
  totalPoints  = 10
  percentage   = 80
  answers      = @(
    @{ number = 1; answer = 'A'    },
    @{ number = 2; answer = 'True' },
    @{ number = 3; answer = '42'   }
  )
  timeTaken    = 600
  timed        = $false
}

Invoke-ApiTest -Name 'Progress Save' -Method 'POST' -Path '/api/progress/save' -ExpectedStatus @(201) `
  -Headers $studentAuthHeaders -Body $progressPayload `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.StudentToken) -or [string]::IsNullOrWhiteSpace($ctx.WorksheetId))

Invoke-ApiTest -Name 'Progress History' -Method 'GET' -Path '/api/progress/history' -ExpectedStatus @(200) `
  -Headers $studentAuthHeaders -Skip:([string]::IsNullOrWhiteSpace($ctx.StudentToken))

Invoke-ApiTest -Name 'Progress Insights' -Method 'GET' -Path '/api/progress/insights' -ExpectedStatus @(200) `
  -Headers $studentAuthHeaders -Skip:([string]::IsNullOrWhiteSpace($ctx.StudentToken))

Invoke-ApiTest -Name 'Progress Parent View' -Method 'GET' `
  -Path "/api/progress/parent/$($ctx.StudentId)" -ExpectedStatus @(200,403,404) `
  -Headers $parentAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.ParentToken) -or [string]::IsNullOrWhiteSpace($ctx.StudentId))

# ─── 6) Analytics ─────────────────────────────────────────────────────────────

Invoke-ApiTest -Name 'Analytics Class' -Method 'GET' `
  -Path "/api/analytics/class/$($ctx.ClassId)" -ExpectedStatus @(200) `
  -Headers $teacherAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.ClassId) -or [string]::IsNullOrWhiteSpace($ctx.TeacherToken))

Invoke-ApiTest -Name 'Analytics Student' -Method 'GET' `
  -Path "/api/analytics/student/$($ctx.StudentId)?classId=$($ctx.ClassId)" -ExpectedStatus @(200) `
  -Headers $teacherAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.ClassId) -or [string]::IsNullOrWhiteSpace($ctx.StudentId) -or [string]::IsNullOrWhiteSpace($ctx.TeacherToken))

# ─── 7) Rewards ───────────────────────────────────────────────────────────────

Invoke-ApiTest -Name 'Rewards Student' -Method 'GET' `
  -Path "/api/rewards/student/$($ctx.StudentId)" -ExpectedStatus @(200) `
  -Headers $studentAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.StudentId) -or [string]::IsNullOrWhiteSpace($ctx.StudentToken))

Invoke-ApiTest -Name 'Rewards Class' -Method 'GET' `
  -Path "/api/rewards/class/$($ctx.ClassId)" -ExpectedStatus @(200) `
  -Headers $teacherAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.ClassId) -or [string]::IsNullOrWhiteSpace($ctx.TeacherToken))

# ─── 8) Certificates ──────────────────────────────────────────────────────────

Invoke-ApiTest -Name 'Certificates List' -Method 'GET' -Path '/api/certificates?limit=10&offset=0' `
  -ExpectedStatus @(200) -Headers $studentAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.StudentToken)) -OnSuccess {
    param($json)
    if ($json -and $json.certificates -and $json.certificates.Count -gt 0) {
      $first = $json.certificates[0]
      if ($first.certificateId) { $ctx.CertificateId            = [string]$first.certificateId }
      if ($first.downloadToken) { $ctx.CertificateDownloadToken = [string]$first.downloadToken }
    }
  }

Invoke-ApiTest -Name 'Certificates Download' -Method 'GET' `
  -Path "/api/certificates/$($ctx.CertificateId)/download?token=$($ctx.CertificateDownloadToken)" `
  -ExpectedStatus @(200) -Headers $studentAuthHeaders `
  -Skip:([string]::IsNullOrWhiteSpace($ctx.CertificateId) -or [string]::IsNullOrWhiteSpace($ctx.CertificateDownloadToken) -or [string]::IsNullOrWhiteSpace($ctx.StudentToken))

# ─── 9) Question bank ─────────────────────────────────────────────────────────

Invoke-ApiTest -Name 'QuestionBank List' -Method 'GET' `
  -Path '/api/qb/questions?grade=4&subject=Math&limit=20&offset=0' -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken

Invoke-ApiTest -Name 'QuestionBank Add' -Method 'POST' -Path '/api/qb/questions' -ExpectedStatus @(201,409) `
  -Headers $defaultProtectedHeaders -Skip:$missingProtectedToken -Body @{
    grade       = 4
    subject     = 'Math'
    topic       = "Fractions $runId"
    difficulty  = 'Medium'
    type        = 'multiple-choice'
    question    = "What is 1/2 of 20? [$runId]"
    options     = @('A. 8', 'B. 10', 'C. 12', 'D. 15')
    answer      = 'B'
    explanation = '1/2 multiplied by 20 equals 10'
    standards   = @('4.NF.B.3')
    author      = 'API Tester'
  } -OnSuccess {
    param($json, $statusCode)
    if (
      $json -and
      $json.PSObject.Properties.Name -contains 'question' -and
      $json.question -and
      $json.question.PSObject.Properties.Name -contains 'id' -and
      $json.question.id
    ) { $ctx.QuestionId = [string]$json.question.id }
  }

Invoke-ApiTest -Name 'QuestionBank Get By ID' -Method 'GET' `
  -Path "/api/qb/questions/$($ctx.QuestionId)" -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders `
  -Skip:($missingProtectedToken -or [string]::IsNullOrWhiteSpace($ctx.QuestionId))

Invoke-ApiTest -Name 'QuestionBank Reuse Track' -Method 'POST' `
  -Path "/api/qb/questions/$($ctx.QuestionId)/reuse" -ExpectedStatus @(200) `
  -Headers $defaultProtectedHeaders -Body @{} `
  -Skip:($missingProtectedToken -or [string]::IsNullOrWhiteSpace($ctx.QuestionId))

# ─── 10) Admin endpoints (requires $AdminToken) ───────────────────────────────

$adminHeaders = @{}
if (-not [string]::IsNullOrWhiteSpace($AdminToken)) {
  $adminHeaders['Authorization'] = "Bearer $AdminToken"
}
$skipAdmin = [string]::IsNullOrWhiteSpace($AdminToken)

Invoke-ApiTest -Name 'Admin Get Policies' -Method 'GET' -Path '/api/admin/policies' `
  -ExpectedStatus @(200) -Headers $adminHeaders -Skip:$skipAdmin

# model-routing: defaultMode (auto|bank-first), allowPremium (bool),
#   premiumEscalation.missingCountThreshold, premiumEscalation.hardQuestionCountThreshold,
#   fallbackOrder (array of low|default|premium — no duplicates), reason (10–300 chars)
Invoke-ApiTest -Name 'Admin Update Model Routing' -Method 'PUT' `
  -Path '/api/admin/policies/model-routing' -ExpectedStatus @(200) `
  -Headers ($adminHeaders + @{ 'Idempotency-Key' = "api-test-$runId-model" }) -Skip:$skipAdmin -Body @{
    defaultMode         = 'auto'
    allowPremium        = $true
    premiumEscalation   = @{ missingCountThreshold = 15; hardQuestionCountThreshold = 10 }
    fallbackOrder       = @('low', 'default', 'premium')
    reason              = 'API test routing update ticket OPS-1001'
  }

# budget-usage: all limits > 0, soft <= hard, softLimitBehavior (log-only|warn-and-log),
#   hardLimitBehavior (block-premium|block-generation), reason (10–300 chars)
Invoke-ApiTest -Name 'Admin Update Budget Usage' -Method 'PUT' `
  -Path '/api/admin/policies/budget-usage' -ExpectedStatus @(200) `
  -Headers ($adminHeaders + @{ 'Idempotency-Key' = "api-test-$runId-budget" }) -Skip:$skipAdmin -Body @{
    dailyUsdSoftLimit   = 100
    dailyUsdHardLimit   = 150
    monthlyUsdSoftLimit = 2500
    monthlyUsdHardLimit = 3000
    softLimitBehavior   = 'log-only'
    hardLimitBehavior   = 'block-premium'
    reason              = 'API test budget update ticket OPS-1002'
  }

# validation-profile: name (lenient|standard|strict|custom),
#   strictness (lenient|balanced|strict), booleans, reason (10–300 chars)
Invoke-ApiTest -Name 'Admin Update Validation Profile' -Method 'PUT' `
  -Path '/api/admin/policies/validation-profile' -ExpectedStatus @(200) `
  -Headers ($adminHeaders + @{ 'Idempotency-Key' = "api-test-$runId-validation" }) -Skip:$skipAdmin -Body @{
    name                       = 'standard'
    strictness                 = 'balanced'
    rejectOnCountMismatch      = $true
    rejectOnSchemaViolation    = $true
    allowPartialIfRecoverable  = $false
    reason                     = 'API test validation profile update ticket OPS-1003'
  }

Invoke-ApiTest -Name 'Admin Get Repeat Cap' -Method 'GET' -Path '/api/admin/policies/repeat-cap' `
  -ExpectedStatus @(200) -Headers $adminHeaders -Skip:$skipAdmin

# repeat-cap: enabled (bool), defaultPercent (0–100 int), reason (10–300 chars)
# Note: minPercent/maxPercent are NOT handler fields — handler only reads enabled/defaultPercent/reason
Invoke-ApiTest -Name 'Admin Update Repeat Cap' -Method 'PUT' `
  -Path '/api/admin/policies/repeat-cap' -ExpectedStatus @(200) `
  -Headers ($adminHeaders + @{ 'Idempotency-Key' = "api-test-$runId-repeatcap" }) -Skip:$skipAdmin -Body @{
    enabled        = $true
    defaultPercent = 10
    reason         = 'API test repeat cap update ticket OPS-1004'
  }

# repeat-cap/overrides: scope (student|teacher|parent), scopeId (alphanum 1-128 chars),
#   repeatCapPercent (0–100 int), reason (10–300 chars)
# FIX: old script used {subject, grade, percent} — handler actually requires {scope, scopeId, repeatCapPercent}
Invoke-ApiTest -Name 'Admin Update Repeat Cap Override' -Method 'PUT' `
  -Path '/api/admin/policies/repeat-cap/overrides' -ExpectedStatus @(200) `
  -Headers ($adminHeaders + @{ 'Idempotency-Key' = "api-test-$runId-override" }) -Skip:$skipAdmin -Body @{
    scope             = 'student'
    scopeId           = "student-$runId"
    repeatCapPercent  = 15
    isActive          = $true
    reason            = 'API test repeat cap override ticket OPS-1005'
  }

Invoke-ApiTest -Name 'Admin Audit Events' -Method 'GET' `
  -Path '/api/admin/audit/events?limit=20&offset=0' -ExpectedStatus @(200) `
  -Headers $adminHeaders -Skip:$skipAdmin

# ─── Results ──────────────────────────────────────────────────────────────────

$passRows  = @($results | Where-Object { $_.Result -eq 'PASS' })
$failRows  = @($results | Where-Object { $_.Result -eq 'FAIL' })
$skipRows  = @($results | Where-Object { $_.Result -eq 'SKIP' })
$passCount = ($passRows | Measure-Object).Count
$failCount = ($failRows | Measure-Object).Count
$skipCount = ($skipRows | Measure-Object).Count
$total     = ($results  | Measure-Object).Count

Write-Host ''
Write-Host '=== API TEST RESULTS ===' -ForegroundColor Cyan
$results | Select-Object Name, Method, Path, StatusCode, Expected, Result | Format-Table -AutoSize

Write-Host ''
Write-Host "Summary: Total=$total  PASS=$passCount  FAIL=$failCount  SKIP=$skipCount" -ForegroundColor Yellow

if ($failCount -gt 0) {
  Write-Host ''
  Write-Host '=== FAILURES (DETAIL) ===' -ForegroundColor Red
  $failRows | Select-Object Name, Method, Path, StatusCode, Expected, Error | Format-Table -Wrap -AutoSize
  exit 1
}

Write-Host ''
Write-Host 'All required API tests passed.' -ForegroundColor Green
exit 0
