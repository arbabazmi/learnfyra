# Learnfyra Admin Console — UX Specification
**Version:** 1.0  
**Date:** March 24, 2026  
**Status:** Design Specification  
**Audience:** Internal Operations Team

---

## Executive Summary

The Learnfyra Admin Console is a web-based internal tool for the operations team to monitor, manage, and maintain the worksheet generation platform. It provides visibility into system health, content quality, user activity, model performance, and operational incidents.

**Key Design Principles:**
- **Clarity over cleverness** — Dense data must be scannable and actionable
- **Safety first** — Destructive actions require confirmation and audit trails
- **Performance at scale** — Handle 10K+ worksheets/day, 1K+ concurrent users
- **Accessibility** — WCAG 2.1 AA compliant for data-dense interfaces
- **Mobile-aware, desktop-first** — Primary use on laptops, monitoring-friendly for tablets

---

## 1. Information Architecture

### 1.1 Navigation Structure

```
Learnfyra Admin Console
│
├── 🏠 Dashboard (/)
│   ├── System Health Overview
│   ├── Key Metrics (worksheets, users, costs)
│   └── Alerts & Incidents Feed
│
├── 📊 Analytics (/analytics)
│   ├── Generation Metrics
│   ├── Solve Metrics
│   ├── Usage by Grade/Subject
│   └── Model Performance
│
├── 👥 Users (/users)
│   ├── User Directory
│   ├── User Detail (/:id)
│   └── API Key Management
│
├── 📝 Content (/content)
│   ├── Worksheet Inventory
│   ├── Worksheet Detail (/:id)
│   ├── Quality Review Queue
│   └── Flagged Content
│
├── 🤖 Model Control (/model)
│   ├── Prompt Management
│   ├── Model Configuration
│   ├── Test Generation
│   └── A/B Tests & Experiments
│
├── 🚨 Incidents (/incidents)
│   ├── Active Incidents
│   ├── Incident Detail (/:id)
│   └── Post-Mortem Archive
│
├── 📈 Reports (/reports)
│   ├── Scheduled Reports
│   ├── Custom Query Builder
│   └── Export History
│
└── ⚙️ Settings (/settings)
    ├── Team & Access Control
    ├── Alert Configuration
    ├── System Preferences
    └── Audit Logs
```

### 1.2 Navigation Component Design

**Top Navigation Bar:**
```
┌────────────────────────────────────────────────────────────┐
│ 🎓 Learnfyra Admin   [Dashboard ▼] [Incidents: 2 🔴]      │
│                                                             │
│  Search...  🔍               [Help] [Profile: AM ▼]       │
└────────────────────────────────────────────────────────────┘
```

**Left Sidebar (collapsible):**
```
┌────────────┐
│ 🏠 Dashboard│ ← active state: teal background
│ 📊 Analytics│
│ 👥 Users    │
│ 📝 Content  │
│ 🤖 Model    │
│ 🚨 Incidents│ 🔴 2 ← badge for active alerts
│ 📈 Reports  │
│ ⚙️ Settings │
│             │
│ ─────────── │
│ 📖 Docs     │
│ 💬 Support  │
└────────────┘
```

**Breadcrumbs:**
```
Dashboard > Content > Worksheet #a47b39 > Quality Review
```

### 1.3 Page Layout Template

```
┌────────────────────────────────────────────────────────────┐
│ Top Nav Bar (fixed)                                        │
├──────┬────────────────────────────────────────────────────┤
│ Side │ Page Header                                         │
│ Nav  │   [Page Title]  [Primary Action Button]            │
│      │   Subtitle or description                          │
│ (fix │ ─────────────────────────────────────────────────  │
│  ed) │                                                     │
│      │ Tab Navigation (if applicable)                     │
│      │ [Overview] [Details] [History] [Notes]             │
│      │ ─────────────────────────────────────────────────  │
│      │                                                     │
│      │ Filters & Actions Bar                              │
│      │ [Filter ▼] [Sort ▼] [Date Range]  [Export] [•••]  │
│      │ ─────────────────────────────────────────────────  │
│      │                                                     │
│      │ Main Content Area                                  │
│      │ (Cards, tables, charts, forms)                     │
│      │                                                     │
│      │                                                     │
│      │                                                     │
│      │                                                     │
└──────┴────────────────────────────────────────────────────┘
```

---

## 2. Dashboard

### 2.1 Purpose
Single-screen overview of system health, key metrics, and actionable alerts for operations team starting their shift or monitoring production.

### 2.2 Layout (Desktop 1440px+)

```
┌─────────────────────────────────────────────────────────────┐
│ 🏠 Dashboard                          Last updated: 14:32   │
├──────────────────┬──────────────────┬──────────────────────┤
│ System Status    │ Worksheets Today │ Active Users         │
│ 🟢 All systems   │ 2,847            │ 1,234                │
│    operational   │ +12% vs Sat      │ +5% vs Sat           │
│                  │                  │                      │
│ API: 99.8%       │ Avg gen: 8.4s    │ Peak: 1,450 (11am)   │
│ Lambda: 99.9%    │ P95: 14.2s       │ Solve rate: 68%      │
└──────────────────┴──────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🚨 Active Alerts & Incidents                   [View All]   │
├─────────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL  P95 latency spiked to 22s (Math Grade 5)      │
│              Started: 14:18  Assigned: @ops-on-call         │
│ ─────────────────────────────────────────────────────────── │
│ 🟡 WARNING   S3 bucket usage at 82% (staging)               │
│              Lifecycle rules pending execution              │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│ Generation Metrics (24h)     │ Model Performance            │
│                              │                              │
│ [Line chart: worksheets/hr]  │ Claude Sonnet 4 (primary)    │
│                              │ Avg tokens: 3,240            │
│ By Subject:                  │ Success rate: 99.2%          │
│ Math       42%  1,195        │ Error rate: 0.8%             │
│ ELA        28%    797        │                              │
│ Science    18%    512        │ Cost per worksheet: $0.12    │
│ Soc.St.     9%    256        │ Daily spend: $341.64         │
│ Health      3%     87        │                              │
└──────────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Recent Quality Flags                            [Review]    │
├─────────────────────────────────────────────────────────────┤
│ • Math Grade 3 - Multiplication: Answer key mismatch (Q7)   │
│ • Science Grade 8 - Photosynthesis: Unclear wording (Q3)    │
│ • ELA Grade 5 - Grammar: Duplicate question detected        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│ Usage by Grade Level         │ Top Topics (7 days)          │
│                              │                              │
│ [Horizontal bar chart]       │ 1. Addition (K-2)       847  │
│ K-2    ████████████  35%     │ 2. Multiplication       723  │
│ 3-5    ████████      28%     │ 3. Reading Comp.        612  │
│ 6-8    ██████        20%     │ 4. Grammar              589  │
│ 9-10   ████          17%     │ 5. Solar System         445  │
└──────────────────────────────┴──────────────────────────────┘
```

### 2.3 Widget Specifications

**System Status Card:**
- Visual: Large status indicator (🟢 green / 🟡 yellow / 🔴 red)
- Metrics: API uptime, Lambda success rate, average response time
- Interactive: Click to expand detailed service health view
- Update frequency: Real-time (WebSocket) or 30s polling

**Worksheets Today Card:**
- Primary metric: Total count with trend arrow and percentage
- Secondary metrics: Average generation time, P95 latency
- Comparison: vs yesterday, vs last week, vs last month
- Interactive: Click to jump to Analytics > Generation Metrics

**Active Users Card:**
- Primary metric: Current concurrent users
- Secondary metrics: Peak users today, solve completion rate
- Chart: Sparkline of last 24 hours
- Interactive: Click to jump to Users directory

**Active Alerts Feed:**
- Priority sorting: CRITICAL > WARNING > INFO
- Visual hierarchy: Color-coded dots, bold titles
- Metadata: Timestamp, assigned team member, status
- Actions: Quick dismiss, assign, escalate buttons
- Max display: 5 alerts, "View All" link to Incidents page

**Generation Metrics Chart:**
- Chart type: Line chart, last 24 hours, hourly buckets
- Toggle: Worksheets/hour vs cumulative
- Breakdown table: By subject with percentage bars
- Export: CSV/PNG download button

**Model Performance Card:**
- Active model badge (name + version)
- Key metrics: Avg tokens, success rate, error rate, cost
- Cost tracking: Per-worksheet and daily total
- Alert threshold indicator: Green < $500/day, Yellow $500-800, Red > $800

**Quality Flags Feed:**
- Display: Last 5 flagged worksheets with reason
- Visual: Icon per flag type (❌ error, ⚠️ warning, 🔍 review)
- Action: "Review" button opens Quality Review Queue
- Badge: Total pending reviews count

---

## 3. Analytics Page

### 3.1 Purpose
Deep-dive analysis of worksheet generation, solve activity, user behavior, and model performance trends over time.

### 3.2 Tab Structure

```
┌────────────────────────────────────────────────────────────┐
│ 📊 Analytics                                               │
│ [Generation] [Solve Activity] [Usage Patterns] [Model]    │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Generation Tab

**Filters Bar:**
```
Date Range: [Last 7 days ▼]  Grade: [All ▼]  Subject: [All ▼]  Difficulty: [All ▼]
[Apply Filters]  [Reset]  [Export CSV]
```

**Key Metrics Grid:**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total        │ Avg Time     │ Success Rate │ Error Rate   │
│ 19,847       │ 8.7s         │ 99.1%        │ 0.9%         │
│ +8% vs prev  │ -0.3s        │ -0.1%        │ +0.1%        │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Primary Chart:**
- Type: Multi-line time series
- Lines: Total generations, successful, failed
- X-axis: Time (daily/hourly toggle)
- Y-axis: Count
- Hover: Tooltip with detailed breakdown
- Zoom: Click-drag to zoom, double-click reset

**Breakdown Tables:**

**By Grade:**
```
Grade   Count   %      Avg Time   Success   Trend
K-2     6,947   35%    7.2s       99.4%     ↑ +12%
3-5     5,557   28%    8.9s       99.0%     ↑ +5%
6-8     3,969   20%    9.4s       98.9%     ↓ -2%
9-10    3,374   17%    10.1s      98.7%     ↑ +9%
```

**By Subject:**
```
Subject         Count   %      Avg Time   Top Topic
Math            8,336   42%    8.4s       Multiplication
ELA             5,557   28%    9.1s       Reading Comp.
Science         3,571   18%    8.9s       Solar System
Social Studies  1,786    9%    8.7s       US History
Health            597    3%    7.8s       Nutrition
```

### 3.4 Solve Activity Tab

**Key Metrics:**
```
Worksheets Solved: 13,458 (68% of generated)
Avg Completion Time: 18m 32s
Avg Score: 76.4%
Timed Mode Usage: 42%
```

**Score Distribution Chart:**
- Type: Histogram
- Bins: 0-20%, 21-40%, 41-60%, 61-80%, 81-100%
- Color: Red → Yellow → Green gradient

**Completion Funnel:**
```
Generated      19,847  ████████████████████  100%
Started        15,234  ███████████████       77%
Submitted      13,458  █████████████▌        68%
Completed      12,789  █████████████         64%
```

### 3.5 Usage Patterns Tab

**Peak Hours Heatmap:**
```
Hour  Mon  Tue  Wed  Thu  Fri  Sat  Sun
08    ██   ██   ██   ██   ██   ░░   ░░
09    ███  ███  ███  ███  ███  █    ░░
10    ███  ███  ███  ███  ███  ██   █
11    ███  ███  ███  ███  ███  ███  ██
12    ██   ██   ██   ██   ██   ███  ██
...
```
Legend: ░░ Low (0-100) █ Med (100-300) ██ High (300-500) ███ Peak (500+)

**Geographic Distribution:**
```
Top States by Usage:
1. California      3,245  ████████████████  16.3%
2. Texas           2,678  █████████████     13.5%
3. New York        2,145  ██████████▌       10.8%
4. Florida         1,987  █████████▌        10.0%
5. Illinois        1,567  ███████▌           7.9%
...
```

### 3.6 Model Tab

**Model Performance Over Time:**
- Chart: Line chart (Token usage, Success rate, Latency, Cost)
- Filter: Model version selector
- Compare: Side-by-side A/B test results

**Error Breakdown:**
```
Error Type              Count   %      Trend
API Timeout             89      45%    ↑ +12%
Token Limit Exceeded    67      34%    → stable
Invalid Response        28      14%    ↓ -5%
Network Error           14       7%    ↓ -8%
```

**Cost Analysis:**
```
Daily Cost Trend (30 days):
[Area chart showing cost per day]

Cost Breakdown:
Model API calls:     $8,247 (85%)
Storage (S3):        $  897  (9%)
Lambda compute:      $  453  (5%)
Data transfer:       $   97  (1%)
────────────────────────────
Total (30d):        $9,694
Monthly projection: $9,694
```

---

## 4. Users Page

### 4.1 Purpose
Manage teacher/student accounts, API keys (future), usage limits, and access control.

### 4.2 User Directory View

**Filters & Search:**
```
┌────────────────────────────────────────────────────────────┐
│ 👥 Users                                    [+ Add User]    │
├────────────────────────────────────────────────────────────┤
│ Search: [name, email, ID...]  🔍                           │
│ Type: [All ▼]  Status: [Active ▼]  Sort: [Last Active ▼]  │
└────────────────────────────────────────────────────────────┘
```

**User Table:**
```
┌──────────┬────────────────┬──────────┬───────────┬───────────┬────────┐
│ ID       │ Name / Email   │ Type     │ Worksheets│ Last Seen │ Status │
├──────────┼────────────────┼──────────┼───────────┼───────────┼────────┤
│ u-a47b39 │ Sarah Johnson  │ Teacher  │ 127       │ 2h ago    │ Active │
│          │ s.johnson@... │          │           │           │        │
├──────────┼────────────────┼──────────┼───────────┼───────────┼────────┤
│ u-3f8c2a │ Mark Davis     │ Teacher  │ 89        │ 1d ago    │ Active │
│          │ m.davis@...   │          │           │           │        │
├──────────┼────────────────┼──────────┼───────────┼───────────┼────────┤
│ u-9d2e1b │ test@example   │ Test     │ 3         │ 14d ago   │ 🔴 Sus │
│          │                │          │           │           │ pended │
├──────────┼────────────────┼──────────┼───────────┼───────────┼────────┤
│ [Load more...] or pagination                                          │
└───────────────────────────────────────────────────────────────────────┘
```

**Row Actions (hover):**
- View Details → User Detail page
- Edit → Quick edit modal
- Suspend/Activate → Safe-action confirmation
- Delete → Dangerous action (see Safe-Action Patterns)

### 4.3 User Detail Page

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ ← Back to Users                                            │
│                                                            │
│ Sarah Johnson (u-a47b39)                    [Edit Profile] │
│ s.johnson@school.edu                        [Suspend User] │
│ Teacher • Active since Jan 15, 2026         [Delete User]  │
├────────────────────────────────────────────────────────────┤
│ [Overview] [Activity] [Worksheets] [API Keys] [Audit Log] │
├────────────────────────────────────────────────────────────┤
│ Overview Tab:                                              │
│                                                            │
│ Account Information                                        │
│ ───────────────────                                        │
│ User ID:        u-a47b39                                   │
│ Name:           Sarah Johnson                              │
│ Email:          s.johnson@school.edu                       │
│ Type:           Teacher                                    │
│ Status:         Active                                     │
│ Joined:         Jan 15, 2026                               │
│ Last Login:     Mar 24, 2026 12:34 PM                      │
│ Login Count:    247                                        │
│                                                            │
│ Usage Statistics                                           │
│ ────────────────                                           │
│ Worksheets Generated:    127                               │
│ Most Used Subject:       Math (45%)                        │
│ Most Used Grade:         Grade 3                           │
│ Avg Worksheets/Week:     8.5                               │
│                                                            │
│ Recent Activity (Last 7 Days)                              │
│ ────────────────────────────────                           │
│ Mar 24  Generated Math Grade 3 worksheet (uuid)            │
│ Mar 24  Generated Science Grade 4 worksheet (uuid)         │
│ Mar 23  Generated ELA Grade 3 worksheet (uuid)             │
│ Mar 22  Generated Math Grade 3 worksheet (uuid)            │
│ [View All Activity →]                                      │
└────────────────────────────────────────────────────────────┘
```

**Activity Tab:**
- Timeline view of all user actions
- Filters: Action type, date range
- Export: CSV download

**Worksheets Tab:**
- Table of all worksheets generated by this user
- Same structure as Content Inventory
- Bulk actions: Export, Delete

**API Keys Tab (future):**
- List of API keys with last-used timestamp
- Generate new key button
- Revoke key button (safe-action)
- Usage limits per key

**Audit Log Tab:**
- All admin actions taken on this account
- Who did what, when, why (reason field)
- Immutable, append-only log

---

## 5. Content Page

### 5.1 Purpose
Search, review, flag, and manage generated worksheets. Support quality assurance workflow.

### 5.2 Worksheet Inventory View

**Search & Filters:**
```
┌────────────────────────────────────────────────────────────┐
│ 📝 Content                                                 │
│ [Inventory] [Quality Queue] [Flagged] [Archive]           │
├────────────────────────────────────────────────────────────┤
│ Search: [title, ID, topic, user...]  🔍                    │
│ Grade: [All ▼]  Subject: [All ▼]  Status: [All ▼]         │
│ Date: [Last 7 days ▼]  Sort: [Newest ▼]                   │
│                                                            │
│ [Export Selected]  [Bulk Delete]  Selected: 0             │
└────────────────────────────────────────────────────────────┘
```

**Worksheet Table:**
```
┌─────┬──────────┬───────────────────┬───────┬────────┬─────────┬────────┐
│ ☐   │ ID       │ Title / Topic     │ Grade │ Subject│ User    │ Status │
├─────┼──────────┼───────────────────┼───────┼────────┼─────────┼────────┤
│ ☐   │ a47b39   │ Multiplication    │ 3     │ Math   │ s.johns │ ✓ OK   │
│     │          │ Practice          │       │        │         │        │
├─────┼──────────┼───────────────────┼───────┼────────┼─────────┼────────┤
│ ☐   │ 3f8c2a   │ Solar System Quiz │ 5     │ Science│ m.davis │ 🔍 Rev │
│     │          │                   │       │        │         │  iew   │
├─────┼──────────┼───────────────────┼───────┼────────┼─────────┼────────┤
│ ☐   │ 9d2e1b   │ Grammar Rules     │ 4     │ ELA    │ l.miller│ 🚩 Flag│
│     │          │                   │       │        │         │  ged   │
├─────┼──────────┼───────────────────┼───────┼────────┼─────────┼────────┤
│ [Load more...] or pagination                                           │
└────────────────────────────────────────────────────────────────────────┘
```

**Row Actions:**
- View → Worksheet Detail page
- Download → Quick download menu (PDF/DOCX/HTML)
- Flag for Review → Opens flag modal
- Delete → Safe-action confirmation

### 5.3 Worksheet Detail Page

**Header:**
```
┌────────────────────────────────────────────────────────────┐
│ ← Back to Content                                          │
│                                                            │
│ Multiplication Practice (a47b39)                           │
│ Grade 3 • Math • Medium Difficulty                         │
│ Generated: Mar 24, 2026 10:23 AM by Sarah Johnson          │
│                                                            │
│ [🔍 Preview] [⬇ Download] [🚩 Flag] [✏️ Edit] [🗑 Delete] │
└────────────────────────────────────────────────────────────┘
```

**Tabs:**
```
[Overview] [Questions] [Solve Data] [Quality] [History]
```

**Overview Tab:**
```
Metadata
────────
ID:              a47b39
Title:           Multiplication Practice
Grade:           3
Subject:         Math
Topic:           Multiplication (2-digit × 1-digit)
Difficulty:      Medium
Standards:       CCSS.MATH.CONTENT.3.OA.C.7
Estimated Time:  20 minutes
Question Count:  10
Total Points:    10

Status
──────
Quality Status:  ✓ Approved
Generated:       Mar 24, 2026 10:23 AM
Generated By:    Sarah Johnson (u-a47b39)
Downloads:       3 (2 PDF, 1 DOCX)
Solves:          2 started, 1 completed
Avg Score:       80%

Files
─────
□ worksheet.pdf     (124 KB)  [Download]
□ worksheet.docx    (87 KB)   [Download]
□ worksheet.html    (45 KB)   [Download]
□ answer-key.pdf    (118 KB)  [Download]
□ solve-data.json   (12 KB)   [Download]
```

**Questions Tab:**
- Rendered preview of all questions
- Each question card shows:
  - Question number and type
  - Question text
  - Answer (masked by default, toggle to reveal)
  - Explanation
  - Points value
- Inline editing capability (saves to solve-data.json)

**Solve Data Tab:**
- Table of solve attempts
- Columns: Student name (if provided), Score, Time taken, Mode (timed/untimed), Submitted at
- Clickable rows expand to show per-question results

**Quality Tab:**
- Quality flags history
- AI-detected issues (if any):
  - Grammar/spelling errors
  - Math errors
  - CCSS/NGSS alignment issues
  - Inappropriate content flags
- Manual review notes
- Approve/Reject buttons

**History Tab:**
- Audit log of all actions on this worksheet
- Who viewed, downloaded, edited, flagged, deleted

### 5.4 Quality Review Queue

**Purpose:** Triage worksheets flagged for quality issues.

**Queue Table:**
```
┌───────┬──────────┬──────────────────┬─────────┬──────────┬─────────┐
│ Prior │ ID       │ Issue            │ Grade   │ Subject  │ Flagged │
├───────┼──────────┼──────────────────┼─────────┼──────────┼─────────┤
│ 🔴 Hi │ 9d2e1b   │ Answer key       │ 4       │ ELA      │ 2h ago  │
│       │          │ mismatch (Q7)    │         │          │         │
├───────┼──────────┼──────────────────┼─────────┼──────────┼─────────┤
│ 🟡 Med│ 3f8c2a   │ Unclear wording  │ 5       │ Science  │ 5h ago  │
│       │          │ (Q3)             │         │          │         │
├───────┼──────────┼──────────────────┼─────────┼──────────┼─────────┤
│ 🟢 Low│ 7a1d4e   │ Duplicate Q      │ 3       │ Math     │ 1d ago  │
│       │          │ detected         │         │          │         │
└───────┴──────────┴──────────────────┴─────────┴──────────┴─────────┘
```

**Review Workflow:**
1. Click row → opens Worksheet Detail in review mode
2. Admin reviews issue, questions, answer key
3. Actions:
   - ✓ Approve (dismiss flag, mark OK)
   - ✏️ Edit & Resubmit (fix issue, regenerate files)
   - 🗑 Delete Worksheet (if irreparable)
   - 🚩 Escalate (assign to content team)

---

## 6. Model Control Page

### 6.1 Purpose
Manage AI model configuration, prompt templates, test generation, and A/B experiments.

### 6.2 Tab Structure

```
┌────────────────────────────────────────────────────────────┐
│ 🤖 Model Control                                           │
│ [Prompt Management] [Model Config] [Test Generation] [A/B]│
└────────────────────────────────────────────────────────────┘
```

### 6.3 Prompt Management Tab

**Active Prompts Table:**
```
┌──────────────┬─────────┬────────────┬───────────┬──────────┐
│ Prompt Name  │ Version │ Model      │ Usage     │ Status   │
├──────────────┼─────────┼────────────┼───────────┼──────────┤
│ Math Prompt  │ v2.3    │ Sonnet 4   │ 8,247/day │ Active   │
│ ELA Prompt   │ v1.8    │ Sonnet 4   │ 5,447/day │ Active   │
│ Science Prom │ v3.1    │ Sonnet 4   │ 3,571/day │ Active   │
│ Math Prompt  │ v2.2    │ Sonnet 4   │ -         │ Archived │
└──────────────┴─────────┴────────────┴───────────┴──────────┘
```

**Prompt Editor:**
- Click row → opens full-screen editor
- Textarea with syntax highlighting for prompt template variables
- Variables: {{grade}}, {{subject}}, {{topic}}, {{difficulty}}, {{questionCount}}
- Preview pane: Test with sample inputs
- Version control:
  - Save as Draft
  - Publish (activates immediately)
  - Rollback to Previous Version (safe-action)

**Prompt Diff View:**
```
Compare Versions: [v2.3 ▼] vs [v2.2 ▼]  [View Diff]

Additions:    +8 lines
Deletions:    -3 lines
Changes:       2 lines

[Side-by-side diff view with + green / - red highlighting]
```

### 6.4 Model Config Tab

**Current Configuration:**
```
Active Model
────────────
Name:              Claude Sonnet 4
Version:           20250514
Max Tokens:        4096
Temperature:       0.7
Top P:             0.9

Fallback Model
──────────────
Name:              Claude Sonnet 3.5
Version:           20240620
Trigger:           Primary failure or latency > 30s

Rate Limits
───────────
Requests/min:      100
Concurrent:        20
Daily budget:      $1,000
Alert threshold:   $800

[Edit Configuration] (safe-action)
```

**Model Selection Dropdown:**
- List of available Anthropic models with cost per 1M tokens
- Selection triggers confirmation modal showing cost impact estimate

### 6.5 Test Generation Tab

**Purpose:** Generate test worksheets to validate prompt/model changes before production.

**Test Form:**
```
Create Test Worksheet
─────────────────────
Grade:        [3 ▼]
Subject:      [Math ▼]
Topic:        [Multiplication ▼]
Difficulty:   [Medium ▼]
Questions:    [10 ▼]
Prompt Ver:   [v2.3 (active) ▼]  or  [v2.4 (draft) ▼]
Model:        [Sonnet 4 ▼]

[Generate Test Worksheet]
```

**Test Results Display:**
- Shows generated worksheet preview
- Metrics: Generation time, tokens used, cost
- Side-by-side comparison if testing against another version
- Quality checklist:
  - ☐ All questions grammatically correct
  - ☐ Answer key matches questions
  - ☐ Appropriate difficulty for grade
  - ☐ Standards correctly applied
  - ☐ No duplicate questions
- Actions:
  - ✓ Approve & Promote Prompt
  - ✗ Reject & Keep Current
  - 🔄 Regenerate with Different Seed

### 6.6 A/B Tests & Experiments Tab

**Active Experiments:**
```
┌────────────┬──────────────┬────────┬────────┬────────┬────────┐
│ Experiment │ Variants     │ Split  │ Sheets │ Winner │ Status │
├────────────┼──────────────┼────────┼────────┼────────┼────────┤
│ Math Prom  │ v2.3 vs v2.4 │ 50/50  │ 1,247  │ TBD    │ Active │
│ pt Test    │              │        │        │        │        │
├────────────┼──────────────┼────────┼────────┼────────┼────────┤
│ ELA Temp   │ 0.5 vs 0.7   │ 50/50  │ 892    │ v2     │ Complt │
│ erature    │              │        │        │        │   ed   │
└────────────┴──────────────┴────────┴────────┴────────┴────────┘
```

**Experiment Detail (click row):**
- Hypothesis statement
- Variants configuration
- Success metrics (quality score, generation time, cost)
- Statistical significance tracker
- Results visualization:
  - Bar charts comparing metrics
  - Distribution plots
  - Confidence intervals
- Actions:
  - End Experiment Early (if clear winner)
  - Promote Winner to Production
  - Discard & Rollback

---

## 7. Incidents Page

### 7.1 Purpose
Track production incidents, coordinate response, document post-mortems.

### 7.2 Active Incidents View

**Incident Table:**
```
┌─────┬──────────┬────────────────────┬──────────┬──────────┬────────┐
│ Sev │ ID       │ Title              │ Started  │ Assigned │ Status │
├─────┼──────────┼────────────────────┼──────────┼──────────┼────────┤
│ 🔴 P1│ INC-0234 │ P95 latency spike │ 14:18    │ @ops-call│ 🔴 Act │
│     │          │ Math Grade 5       │          │          │  ive   │
├─────┼──────────┼────────────────────┼──────────┼──────────┼────────┤
│ 🟡 P2│ INC-0232 │ S3 bucket 82% full│ 09:30    │ @devops  │ 🟡 Mit │
│     │          │ staging env        │          │          │ igating│
├─────┼──────────┼────────────────────┼──────────┼──────────┼────────┤
│ 🟢 P3│ INC-0228 │ Slow downloads     │ Mar 22   │ @backend │ 🟢 Res │
│     │          │ EU region          │          │          │ olved  │
└─────┴──────────┴────────────────────┴──────────┴──────────┴────────┘
```

**Priority Definitions (always visible):**
```
P1: User-facing service down or severely degraded (resolve within 1 hour)
P2: Partial degradation or non-critical service impacted (resolve within 4 hours)
P3: Minor issues with workarounds available (resolve within 1 business day)
```

### 7.3 Incident Detail Page

**Header:**
```
┌────────────────────────────────────────────────────────────┐
│ ← Back to Incidents                                        │
│                                                            │
│ INC-0234: P95 latency spike - Math Grade 5                │
│ 🔴 P1 CRITICAL • Active • Started: Mar 24, 2026 14:18     │
│                                                            │
│ Assigned: @ops-on-call                [Reassign]          │
│ Impact: ~450 users affected           [Update Status ▼]   │
│ Duration: 14 minutes (ongoing)        [Resolve]           │
└────────────────────────────────────────────────────────────┘
```

**Tabs:**
```
[Timeline] [Impact] [Actions Taken] [Root Cause] [Post-Mortem]
```

**Timeline Tab:**
```
Timeline (Real-time updates)
────────────────────────────
14:32  @ops-on-call: Identified slow DB queries via CloudWatch
14:28  @ops-on-call: Scaled Lambda to 1024MB, no improvement
14:22  System: Alert triggered: P95 latency > 20s
14:18  System: Latency spike detected

[Add Timeline Entry]  [internal note or user-facing update]
```

**Impact Tab:**
```
Affected Systems
────────────────
✗ Math worksheet generation (Grade 5)
✓ Other subjects/grades functioning normally
✓ Solve functionality operational
✓ Download service operational

Affected Users
──────────────
~450 users attempted Math Grade 5 generation during incident
~87 users experienced timeout errors
~363 users experienced slow generation (20-40s)

User Impact Statement (auto-posted to status page):
"We are currently experiencing slower-than-normal worksheet
generation times for Math Grade 5. We are actively working
on a fix. All other grades and subjects are unaffected."
[Edit Statement]
```

**Actions Taken Tab:**
```
Mitigation Steps
────────────────
□ Investigate CloudWatch logs
□ Check Lambda concurrency limits
□ Review recent prompt changes
□ Test with different model version
□ Scale infrastructure resources
□ Rollback recent deployment (if needed)

Actions Log
───────────
14:32  Checked DB queries - no obvious bottleneck
14:28  Scaled Lambda memory 512MB → 1024MB
14:24  Reviewed recent code deployments - none in last 24h
14:22  On-call engineer paged
```

**Root Cause Tab (filled post-resolution):**
```
Root Cause Analysis
───────────────────
Immediate Cause:
[Textarea for detailed explanation]

Contributing Factors:
• [Factor 1]
• [Factor 2]

Why did this happen?
[Five Whys analysis]

Detection Time: 4 minutes (alert → on-call paged)
Resolution Time: 18 minutes (page → fix deployed)
```

**Post-Mortem Tab:**
```
Post-Mortem (required for P1/P2 incidents)
───────────────────────────────────────────
Status: [Draft ▼]  Assigned: [Select team member ▼]
Due Date: Mar 25, 2026 (within 24h of resolution)

Sections:
• Incident Summary
• Impact Assessment
• Root Cause Analysis
• Timeline of Events
• What Went Well
• What Went Wrong
• Action Items

[Edit in Full-Screen Editor]
[Publish Post-Mortem]  (shares with team, archives incident)
```

### 7.4 Create Incident Button

**Form Modal:**
```
Create New Incident
───────────────────
Title:        [Short descriptive title]
Severity:     [P1 ▼]  (shows definition on hover)
Description:  [Detailed description...]
Assigned To:  [@ops-team ▼]
Affected:     ☐ Generation  ☐ Solve  ☐ Download  ☐ API

[Create Incident]  [Cancel]
```

---

## 8. Reports Page

### 8.1 Purpose
Schedule automated reports, build custom queries, export data for analysis.

### 8.2 Tab Structure

```
┌────────────────────────────────────────────────────────────┐
│ 📈 Reports                                                 │
│ [Scheduled Reports] [Custom Queries] [Export History]     │
└────────────────────────────────────────────────────────────┘
```

### 8.3 Scheduled Reports Tab

**Reports List:**
```
┌──────────────────┬───────────┬─────────────┬────────────┬─────────┐
│ Report Name      │ Frequency │ Recipients  │ Last Run   │ Actions │
├──────────────────┼───────────┼─────────────┼────────────┼─────────┤
│ Daily Usage Sum  │ Daily     │ ops@learn   │ Today 8am  │ [Edit]  │
│ mary             │ 8am       │ fyra.com    │            │ [Run]   │
├──────────────────┼───────────┼─────────────┼────────────┼─────────┤
│ Weekly Quality   │ Weekly    │ qa@learn    │ Mar 18     │ [Edit]  │
│ Report           │ Mon 9am   │ fyra.com    │ 9am        │ [Run]   │
├──────────────────┼───────────┼─────────────┼────────────┼─────────┤
│ Monthly Cost Rev │ Monthly   │ finance@... │ Mar 1      │ [Edit]  │
│ iew              │ 1st, 9am  │             │ 9am        │ [Run]   │
└──────────────────┴───────────┴─────────────┴────────────┴─────────┘
```

**Create/Edit Report Form:**
```
Report Configuration
────────────────────
Name:         [Daily Usage Summary]
Description:  [Description of report contents]

Data Source:  [Worksheet Generation ▼]
Metrics:      ☑ Total count  ☑ By subject  ☑ By grade
              ☑ Success rate  ☐ Error breakdown

Filters:      Date range: [Last 24 hours ▼]
              Grade: [All ▼]  Subject: [All ▼]

Schedule:     ☑ Enable scheduled delivery
              Frequency: [Daily ▼]  at [08:00 ▼]
              Timezone: [America/New_York ▼]

Delivery:     Email: [ops@learnfyra.com]  [+ Add]
              Format: [PDF ▼]  [CSV ▼]  [Excel ▼]

[Save Report]  [Run Now]  [Cancel]
```

### 8.4 Custom Queries Tab

**Query Builder Interface:**
```
Build Custom Query
──────────────────
Data Source:  [Worksheets ▼]

Select Columns:
☑ ID
☑ Title
☑ Grade
☑ Subject
☑ Generated Date
☑ User ID
☐ Question Count
☐ Downloads
☐ Solves

Filters:
Grade:           [All ▼]
Subject:         [Math ▼]
Date Range:      [Last 30 days ▼]
Status:          [All ▼]

[+ Add Filter]

Sort By:         [Generated Date ▼]  [Desc ▼]
Limit:           [1000 ▼] rows

[Run Query]  [Save as Report]  [Export CSV]
```

**Query Results Table:**
- Displays results in sortable, paginated table
- Click column headers to re-sort
- Select rows for batch export
- Preview button opens Worksheet Detail in modal

**Save Query:**
- Saves configuration for reuse
- Can convert to scheduled report

### 8.5 Export History Tab

**Export Log:**
```
┌────────────┬──────────────────┬────────┬──────────┬─────────┬──────────┐
│ Export ID  │ Report / Query   │ Format │ Rows     │ User    │ Date     │
├────────────┼──────────────────┼────────┼──────────┼─────────┼──────────┤
│ exp-a47b39 │ Daily Usage Sum  │ PDF    │ -        │ @ops    │ Today    │
│            │                  │        │          │         │ 8:00am   │
├────────────┼──────────────────┼────────┼──────────┼─────────┼──────────┤
│ exp-3f8c2a │ Custom: Math Wks │ CSV    │ 8,247    │ @admin  │ Today    │
│            │                  │        │          │         │ 2:15pm   │
└────────────┴──────────────────┴────────┴──────────┴─────────┴──────────┘
```

- Click row → download export file (stored in S3 for 7 days)
- Expired exports show "Expired" status with no download link

---

## 9. Settings Page

### 9.1 Tab Structure

```
┌────────────────────────────────────────────────────────────┐
│ ⚙️ Settings                                                │
│ [Team & Access] [Alert Config] [System Prefs] [Audit Logs]│
└────────────────────────────────────────────────────────────┘
```

### 9.2 Team & Access Tab

**Team Members:**
```
┌────────────────┬──────────────┬────────────────┬──────────┐
│ Name           │ Email        │ Role           │ Status   │
├────────────────┼──────────────┼────────────────┼──────────┤
│ Alex Martinez  │ a.martinez@  │ Admin          │ Active   │
│                │              │ (full access)  │          │
├────────────────┼──────────────┼────────────────┼──────────┤
│ Jordan Lee     │ j.lee@       │ Content        │ Active   │
│                │              │ (content only) │          │
└────────────────┴──────────────┴────────────────┴──────────┘

[+ Invite Team Member]
```

**Role Definitions:**
```
Admin:     Full access to all pages and actions
Content:   Content management, quality review, no infra access
Support:   View-only access, can flag content, no delete/edit
Billing:   Analytics, reports, cost dashboards, no operations
```

**Invite Modal:**
```
Invite Team Member
──────────────────
Email:    [member@learnfyra.com]
Role:     [Content ▼]
Message:  [Optional welcome message]

[Send Invitation]  [Cancel]
```

### 9.3 Alert Configuration Tab

**Alert Rules:**
```
┌────────────────────┬───────────┬────────────────┬──────────┐
│ Alert              │ Threshold │ Recipients     │ Enabled  │
├────────────────────┼───────────┼────────────────┼──────────┤
│ P95 Latency        │ > 20s     │ @ops-on-call   │ ☑ Yes    │
├────────────────────┼───────────┼────────────────┼──────────┤
│ Error Rate         │ > 1%      │ @dev-team      │ ☑ Yes    │
├────────────────────┼───────────┼────────────────┼──────────┤
│ Daily Cost         │ > $800    │ @finance, @ops │ ☑ Yes    │
├────────────────────┼───────────┼────────────────┼──────────┤
│ S3 Bucket Usage    │ > 80%     │ @devops        │ ☑ Yes    │
├────────────────────┼───────────┼────────────────┼──────────┤
│ Quality Flags      │ > 10/day  │ @qa-team       │ ☑ Yes    │
└────────────────────┴───────────┴────────────────┴──────────┘

[+ Create Alert Rule]
```

**Alert Channels:**
```
Notification Channels
─────────────────────
☑ Email            recipients@learnfyra.com
☑ Slack            #learnfyra-alerts
☐ PagerDuty        (not configured)
☐ SMS              (not configured)

[Configure Channels]
```

### 9.4 System Preferences Tab

**General Settings:**
```
Worksheet Retention
───────────────────
Delete worksheets after:  [7 ▼] days
Archive before deletion:  ☑ Yes

Download Limits
───────────────
Max downloads per user/day:   [100 ▼]
Presigned URL expiration:     [1 ▼] hour

Quality Thresholds
──────────────────
Auto-flag if error rate:      [> 5% ▼]
Auto-approve if score:         [> 95% ▼]

Maintenance Mode
────────────────
Status:  ☐ Enabled
Message: [Custom maintenance message for users]

[Save Changes]
```

### 9.5 Audit Logs Tab

**Audit Log Table:**
```
┌──────────┬──────────┬────────────────────────┬──────────────┐
│ Time     │ User     │ Action                 │ Target       │
├──────────┼──────────┼────────────────────────┼──────────────┤
│ 14:45    │ a.martiz │ Deleted worksheet      │ ws-9d2e1b    │
│          │          │ Reason: Duplicate      │              │
├──────────┼──────────┼────────────────────────┼──────────────┤
│ 14:32    │ j.lee    │ Approved quality flag  │ ws-3f8c2a    │
├──────────┼──────────┼────────────────────────┼──────────────┤
│ 14:18    │ system   │ Created incident       │ INC-0234     │
├──────────┼──────────┼────────────────────────┼──────────────┤
│ 10:23    │ a.martiz │ Changed model config   │ Claude S4    │
│          │          │ temp: 0.7 → 0.5        │              │
└──────────┴──────────┴────────────────────────┴──────────────┘
```

**Filters:**
```
User: [All ▼]  Action: [All ▼]  Date: [Last 7 days ▼]
[Apply]  [Export CSV]
```

---

## 10. Safe-Action UX Patterns

### 10.1 Confirmation Levels

**Level 1: Low Risk — Toast Notification**
- Use for: Flagging content, editing metadata, creating reports
- Pattern: Action happens immediately, undo toast appears for 5s
```
Action performed successfully  [Undo]  ✕
```

**Level 2: Medium Risk — Modal Confirmation**
- Use for: Deleting single items, suspending users, rolling back prompts
- Pattern: Modal with "Are you sure?" message + confirm button
```
┌──────────────────────────────────────┐
│ Confirm Deletion                     │
├──────────────────────────────────────┤
│ Are you sure you want to delete      │
│ worksheet "Multiplication Practice"? │
│                                      │
│ This action cannot be undone.        │
│                                      │
│ [Cancel]              [Delete]       │
└──────────────────────────────────────┘
```
- Confirm button is secondary color (not primary CTA color)
- 3-second delay before button becomes clickable (prevents mis-clicks)

**Level 3: High Risk — Typed Confirmation**
- Use for: Bulk deletes, disabling production model, purging data
- Pattern: Modal requiring user to type specific phrase
```
┌──────────────────────────────────────────────┐
│ ⚠️ Dangerous Action                          │
├──────────────────────────────────────────────┤
│ You are about to DELETE 247 WORKSHEETS.     │
│                                              │
│ This action is IRREVERSIBLE and will affect  │
│ all users who have downloaded these files.   │
│                                              │
│ Type "DELETE 247 WORKSHEETS" to confirm:     │
│ [                                          ] │
│                                              │
│ [Cancel]              [Confirm Delete]       │
│                          (disabled until     │
│                           text matches)      │
└──────────────────────────────────────────────┘
```

**Level 4: Critical — Two-Person Approval**
- Use for: Production deployment, model version change, disabling service
- Pattern: Initiator requests approval, admin must approve via separate screen
```
┌──────────────────────────────────────────────┐
│ 🔐 Approval Required                         │
├──────────────────────────────────────────────┤
│ @alex.martinez has requested permission to:  │
│                                              │
│ CHANGE PRODUCTION MODEL                      │
│ From: Claude Sonnet 4 (v20250514)            │
│ To:   Claude Opus 4 (v20250520)              │
│                                              │
│ Estimated cost impact: +$147/day             │
│                                              │
│ Reason:                                      │
│ "Testing improved quality for science        │
│  worksheets based on A/B test results."      │
│                                              │
│ [Deny]                  [Approve & Deploy]   │
└──────────────────────────────────────────────┘
```
- Approval requests appear in header badge: [Approvals: 1 🟡]
- Denied requests log reason to audit log

### 10.2 Reason Field Requirement

All destructive actions require a reason field:
```
┌──────────────────────────────────────┐
│ Confirm Deletion                     │
├──────────────────────────────────────┤
│ Worksheet: Multiplication Practice   │
│                                      │
│ Reason (required):                   │
│ [Duplicate content, already exists  ]│
│ [                                   ]│
│                                      │
│ [Cancel]              [Delete]       │
└──────────────────────────────────────┘
```
- Reason field logged to audit trail
- Common reasons available as quick-select chips
- Custom reason always available

### 10.3 Batch Action Safety

When selecting multiple items:
```
Selected: 23 worksheets                [Deselect All]

Bulk Actions:
[Export CSV]  [Download ZIP]  [Flag for Review]  [Delete...]
```

Delete button triggers Level 3 (typed confirmation) if count > 10, else Level 2 (modal confirmation).

Preview modal before bulk action:
```
┌──────────────────────────────────────────────┐
│ Review Bulk Action                           │
├──────────────────────────────────────────────┤
│ You are about to DELETE 23 worksheets:       │
│                                              │
│ ☑ ws-a47b39  Multiplication Practice         │
│ ☑ ws-3f8c2a  Solar System Quiz               │
│ ☑ ws-9d2e1b  Grammar Rules                   │
│ ... (20 more)                                │
│                                              │
│ [View Full List]                             │
│                                              │
│ Reason: [                                ]   │
│                                              │
│ [Cancel]              [Confirm Delete]       │
└──────────────────────────────────────────────┘
```

---

## 11. Accessibility for Dense Data Interfaces

### 11.1 WCAG 2.1 AA Compliance

**Color Contrast:**
- Text: Minimum 4.5:1 ratio for normal text, 3:1 for large text (18pt+)
- Status indicators: Never rely on color alone
  - ✓ Good: 🟢 "Active" (icon + text + color)
  - ✗ Bad: Green cell only (color only)

**Focus Management:**
- Visible focus indicator on all interactive elements (2px outline, 3:1 contrast)
- Skip-to-content link at top of page
- Focus trap in modals (tab cycles within modal)
- Return focus to trigger element on modal close

**Keyboard Navigation:**
```
Tables:
- Tab: Move to next interactive element (button, link, input)
- Arrow keys: Navigate between table cells
- Space/Enter: Activate button or link
- Escape: Close modal or dropdown

Filters:
- Tab: Move between filter controls
- Enter: Apply filter
- Escape: Clear/reset filter

Charts:
- Tab: Focus chart container
- Arrow keys: Navigate data points
- Enter: Show tooltip for focused point
```

### 11.2 Screen Reader Support

**Table Markup:**
```html
<table role="table" aria-label="Worksheet Inventory">
  <thead>
    <tr>
      <th scope="col">ID</th>
      <th scope="col">Title</th>
      <th scope="col">Grade</th>
      <th scope="col" aria-sort="descending">Date ↓</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>a47b39</td>
      <td>Multiplication Practice</td>
      <td>3</td>
      <td>Mar 24, 2026</td>
    </tr>
  </tbody>
</table>
```

**Status Indicators:**
```html
<span class="status status--active" role="img" aria-label="Active">
  🟢 Active
</span>

<span class="status status--warning" role="img" aria-label="Warning">
  🟡 Warning
</span>
```

**Loading States:**
```html
<div role="status" aria-live="polite" aria-busy="true">
  Loading worksheets...
</div>

<!-- After load: -->
<div role="status" aria-live="polite">
  Loaded 247 worksheets
</div>
```

**Error Messages:**
```html
<div role="alert" aria-live="assertive">
  Error: Failed to delete worksheet. Please try again.
</div>
```

### 11.3 Data Table Best Practices

**Pagination:**
```
Showing 1-50 of 2,847 worksheets

[Previous]  [1] [2] [3] ... [57]  [Next]

aria-label="Pagination navigation"
aria-current="page" on active page number
```

**Sortable Columns:**
```
[Column Header ↓]
aria-sort="ascending" | "descending" | "none"
Keyboard: Space/Enter to toggle sort
```

**Row Actions:**
```
<!-- Hidden label for screen readers -->
<button aria-label="View worksheet a47b39">
  View
</button>

<!-- Or use aria-describedby -->
<button aria-describedby="worksheet-title-a47b39">
  View
</button>
<span id="worksheet-title-a47b39" hidden>
  Multiplication Practice
</span>
```

**Expandable Rows:**
```
<tr>
  <td>
    <button aria-expanded="false" aria-controls="row-details-a47b39">
      Expand
    </button>
  </td>
  <td>...</td>
</tr>
<tr id="row-details-a47b39" hidden>
  <td colspan="6">
    <!-- Expanded content -->
  </td>
</tr>
```

### 11.4 Chart Accessibility

**Provide Text Alternative:**
```html
<figure>
  <div id="chart-container" role="img" aria-labelledby="chart-title chart-description">
    <!-- Chart rendered here -->
  </div>
  <figcaption id="chart-title">
    Worksheet Generation by Subject (Last 7 Days)
  </figcaption>
  <div id="chart-description" hidden>
    Bar chart showing worksheet generation counts by subject.
    Math: 8,336 (42%), ELA: 5,557 (28%), Science: 3,571 (18%),
    Social Studies: 1,786 (9%), Health: 597 (3%).
  </div>
</figure>
```

**Data Table Alternative:**
```
[View as Table] button below chart
Opens accessible data table with same data
```

### 11.5 Mobile Responsiveness (Tablet Support)

Admin console is desktop-first, but tablet-friendly for monitoring:

**Breakpoints:**
```
Desktop:  1440px+    (primary experience)
Laptop:   1024-1439px (compact layout)
Tablet:   768-1023px  (read-only monitoring)
Mobile:   < 768px     (not supported — redirect to "Use desktop" page)
```

**Tablet Adaptations:**
- Sidebar collapses to hamburger menu
- Tables scroll horizontally with sticky first column
- Cards stack vertically instead of grid
- Charts shrink to fit, maintain aspect ratio
- Forms remain usable but require more scrolling

---

## 12. Visual Design System

### 12.1 Color Palette (Admin Console Theme)

**Primary Colors:**
```
--admin-navy:      #1E293B   /* Primary text, headers */
--admin-blue:      #3B82F6   /* Primary actions, links */
--admin-slate:     #64748B   /* Secondary text */
--admin-cloud:     #F1F5F9   /* Backgrounds, cards */
--admin-white:     #FFFFFF   /* Content areas */
```

**Status Colors:**
```
--status-success:  #10B981   /* Green — success, active, approved */
--status-warning:  #F59E0B   /* Amber — warning, pending */
--status-error:    #EF4444   /* Red — error, critical, down */
--status-info:     #3B82F6   /* Blue — info, neutral */
```

**Semantic Colors:**
```
--priority-p1:     #DC2626   /* Critical (darker red) */
--priority-p2:     #F59E0B   /* Warning (amber) */
--priority-p3:     #10B981   /* Low (green) */
```

### 12.2 Typography

**Fonts:**
```
Headings:   'Inter' 600 (semibold)
Body:       'Inter' 400 (regular)
Mono:       'JetBrains Mono' 400 (for IDs, code, logs)
```

**Scale:**
```
h1: 32px / 40px line-height (page titles)
h2: 24px / 32px (section headers)
h3: 20px / 28px (card titles)
h4: 18px / 24px (subsection headers)
body: 14px / 20px (default text)
small: 12px / 16px (metadata, timestamps)
```

### 12.3 Spacing Scale

```
--space-xs:   4px   (tight gaps, icon margins)
--space-sm:   8px   (compact spacing)
--space-md:   16px  (default gap between elements)
--space-lg:   24px  (section spacing)
--space-xl:   32px  (major section breaks)
--space-2xl:  48px  (page section dividers)
```

### 12.4 Component Patterns

**Card:**
```
background: var(--admin-white)
border: 1px solid #E5E7EB
border-radius: 8px
padding: var(--space-lg)
box-shadow: 0 1px 3px rgba(0,0,0,0.1)
```

**Button:**
```
Primary:
  background: var(--admin-blue)
  color: white
  padding: 10px 20px
  border-radius: 6px
  font-weight: 600

Secondary:
  background: white
  color: var(--admin-navy)
  border: 1px solid #D1D5DB
  padding: 10px 20px
  border-radius: 6px

Danger:
  background: var(--status-error)
  color: white
  (same structure as primary)
```

**Table:**
```
Header:
  background: var(--admin-cloud)
  font-weight: 600
  text-transform: uppercase
  font-size: 12px
  letter-spacing: 0.05em
  padding: 12px 16px
  border-bottom: 2px solid #D1D5DB

Row:
  padding: 12px 16px
  border-bottom: 1px solid #E5E7EB

Row (hover):
  background: #F9FAFB
```

**Status Badge:**
```
display: inline-flex
align-items: center
padding: 4px 12px
border-radius: 999px (pill)
font-size: 12px
font-weight: 600

Active:   background: #D1FAE5  color: #065F46  (green)
Warning:  background: #FEF3C7  color: #92400E  (amber)
Error:    background: #FEE2E2  color: #991B1B  (red)
```

---

## 13. Implementation Notes

### 13.1 Tech Stack Recommendations

**Frontend:**
- React 18+ with TypeScript
- Data fetching: React Query (caching, refetching, optimistic updates)
- Tables: TanStack Table (sorting, filtering, pagination)
- Charts: Recharts or Victory (accessible, React-native)
- Forms: React Hook Form + Zod validation
- Routing: React Router v6
- State: Context API + React Query (no Redux needed)

**Design System:**
- Tailwind CSS (utility-first, matches existing frontend)
- Headless UI (accessible components)
- Radix UI (for complex components: Select, Dialog, Tooltip)

**Build:**
- Vite (faster than CRA)
- ESLint + Prettier
- TypeScript strict mode

### 13.2 API Endpoints (to be built)

```
Authentication:
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/auth/me

Dashboard:
GET    /api/admin/dashboard/metrics
GET    /api/admin/dashboard/alerts
GET    /api/admin/dashboard/activity

Users:
GET    /api/admin/users
GET    /api/admin/users/:id
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id

Content:
GET    /api/admin/worksheets
GET    /api/admin/worksheets/:id
DELETE /api/admin/worksheets/:id
POST   /api/admin/worksheets/:id/flag
PUT    /api/admin/worksheets/:id/quality

Model:
GET    /api/admin/prompts
PUT    /api/admin/prompts/:id
GET    /api/admin/model/config
PUT    /api/admin/model/config
POST   /api/admin/model/test

Incidents:
GET    /api/admin/incidents
POST   /api/admin/incidents
PUT    /api/admin/incidents/:id
POST   /api/admin/incidents/:id/timeline

Reports:
GET    /api/admin/reports
POST   /api/admin/reports/run
GET    /api/admin/reports/exports

Settings:
GET    /api/admin/settings
PUT    /api/admin/settings
GET    /api/admin/audit-logs
```

### 13.3 Security & Access Control

**Authentication:**
- Admin console requires separate authentication (not same as user accounts)
- OAuth2 via Google Workspace (learnfyra.com domain only)
- Session timeout: 8 hours
- Refresh token rotation

**Authorization:**
- Role-based access control (RBAC)
- Permissions checked on every API call
- Frontend hides UI for unauthorized actions (but backend enforces)

**Audit Trail:**
- Every action logged with:
  - User ID
  - Action type
  - Target resource
  - Timestamp
  - IP address
  - User agent
  - Reason (if required)
- Logs stored in S3, immutable, 7-year retention (compliance)

### 13.4 Performance Targets

**Page Load:**
- Initial load: < 2s (desktop, cable)
- Dashboard: < 1s (subsequent visits, cached)
- Table data: < 500ms (API response)

**Data Table:**
- Render 100 rows: < 100ms
- Sort/filter: < 50ms (client-side)
- Pagination: < 200ms (API fetch)

**Charts:**
- Render: < 200ms
- Interaction (hover): < 16ms (60fps)

**Real-time Updates:**
- WebSocket connection for dashboard alerts
- Polling fallback for older browsers (30s interval)

---

## 14. Open Questions & Future Enhancements

### 14.1 Phase 1 (MVP — covered in this spec)
- ✅ Dashboard with system health
- ✅ Content inventory and quality review
- ✅ User management (basic)
- ✅ Incident tracking
- ✅ Basic analytics and reports

### 14.2 Phase 2 (Future)
- [ ] Advanced analytics: Funnel analysis, cohort retention, LTV
- [ ] Student solve analytics: Per-question accuracy, time distribution
- [ ] Teacher accounts: Self-service onboarding, usage quotas
- [ ] API key management: Public API access for integrations
- [ ] Webhook configuration: External system notifications
- [ ] Custom dashboards: Drag-and-drop widget builder
- [ ] Slack integration: Alerts in Slack channels
- [ ] Mobile app: iOS/Android for on-call monitoring

### 14.3 Phase 3 (Advanced)
- [ ] Machine learning insights: Quality prediction, anomaly detection
- [ ] Multi-tenant support: White-label admin for partner schools
- [ ] Advanced experiments: Multi-variant A/B/C/D tests
- [ ] Cost optimization recommendations: Auto-suggest cheaper models
- [ ] 24/7 chatbot: AI assistant for ops team queries

---

## 15. Success Metrics

**Operational Efficiency:**
- Incident detection time: < 5 minutes (alert → on-call notified)
- Incident resolution time: < 30 minutes for P1, < 4 hours for P2
- False positive rate: < 5% (alerts that don't require action)

**Quality Assurance:**
- Quality review queue cleared daily: 100% of flagged content reviewed within 24h
- Manual intervention rate: < 2% (worksheets flagged for human review)

**Team Satisfaction:**
- Admin console NPS: > 50 (survey ops team quarterly)
- Daily active usage: 100% of ops team (everyone uses it every shift)

**System Health:**
- Dashboard load time: < 1s
- API response time (p95): < 500ms
- Uptime: 99.9% (admin console availability)

---

## 16. Timeline & Rollout

**Phase 1: MVP (8 weeks)**
- Week 1-2: Design system + component library
- Week 3-4: Dashboard + Analytics pages
- Week 5-6: Content + User management pages
- Week 7: Incidents + Reports pages
- Week 8: Settings + QA testing

**Phase 2: Beta Testing (2 weeks)**
- Deploy to staging
- Ops team dog-fooding
- Iterate based on feedback

**Phase 3: Production Launch**
- Deploy to prod
- Monitor usage and performance
- Iterate based on real-world data

---

## Appendix A: Glossary

- **P1/P2/P3:** Priority levels for incidents (P1 = critical, P2 = high, P3 = medium)
- **P95 latency:** 95th percentile latency (95% of requests faster than this)
- **NPS:** Net Promoter Score (customer satisfaction metric)
- **Presigned URL:** Temporary S3 URL with time-limited access
- **Cold start:** Initial Lambda invocation delay (first request)
- **CCSS:** Common Core State Standards (USA curriculum)
- **NGSS:** Next Generation Science Standards

---

**End of UX Specification**

For questions or clarifications, contact: design@learnfyra.com
