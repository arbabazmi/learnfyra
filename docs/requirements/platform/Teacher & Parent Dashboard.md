Here’s a **clean, structured requirement markdown file** you can directly copy into your requirement folder (or save as `module-4-teacher-parent-dashboard.md`):

---

# 📘 Module 4: Teacher & Parent Dashboard (T&P Portal)

## 1. 🎯 Purpose

Enable teachers and parents to:

* Monitor student learning activity
* Assign worksheets and homework
* Track performance and progress
* Identify weak areas and intervene early

---

## 2. 👥 User Roles

### 2.1 Teacher

* Manage multiple students/classes
* Assign worksheets (individual or group)
* View class-level analytics
* Track overall performance trends

### 2.2 Parent

* Linked to one or more students (children)
* View student performance
* Optionally assign worksheets (restricted)
* Receive progress updates and alerts

---

## 3. 🔐 Authentication & Authorization

* Authentication via AWS Cognito
* Role-based access control (RBAC)

### Roles:

* STUDENT
* TEACHER
* PARENT
* ADMIN

### Access Rules:

| Role    | Permissions                      |
| ------- | -------------------------------- |
| Teacher | Full access to assigned students |
| Parent  | Access only to linked children   |
| Student | Access own data only             |

---

## 4. 📦 Core Functional Requirements

---

### 4.1 Student Activity Tracking

#### Description:

Teachers and parents can view detailed student activity.

#### Data Points:

* Worksheets attempted
* Score
* Time spent
* Completion status
* Attempt date
* Topic performance

#### Sample Data Model:

```json
{
  "studentId": "S123",
  "worksheetId": "W456",
  "score": 80,
  "timeSpent": 1200,
  "status": "COMPLETED",
  "attemptDate": "timestamp"
}
```

---

### 4.2 Assignment System

#### Description:

Allows teachers and parents to assign worksheets.

#### Features:

**Teacher:**

* Assign to:

  * Individual student
  * Multiple students
  * Entire class
* Set:

  * Due date
  * Difficulty level
  * Topic

**Parent:**

* Assign only to their child (optional feature)

#### Workflow:

```
Select Worksheet → Assign → Student Solves → Submit → Report Generated
```

---

### 4.3 Reports & Analytics

#### A. Student-Level Report

* Accuracy (%)
* Topic-wise performance
* Time per question
* Attempt history

#### B. Class-Level Report (Teacher Only)

* Average score
* Top performers
* Weak topics
* Completion rate

#### C. Comparative Analysis

* Student vs class average
* Performance trends over time

---

### 4.4 Weak Area Detection (AI-Driven - Future Ready)

#### Description:

Identify weak areas using analytics/AI.

#### Features:

* Detect frequently incorrect topics
* Identify slow response areas
* Recommend practice worksheets

---

### 4.5 Worksheet Library Access

#### Description:

Teachers and parents can browse and reuse worksheets.

#### Features:

* View generated worksheets
* Reuse from question bank
* Save favorites

---

### 4.6 Notification System

#### Events:

* New assignment
* Due date reminder
* Worksheet completion

#### Suggested Implementation:

* AWS SNS / EventBridge

---

### 4.7 Progress Timeline

#### Description:

Visual representation of student progress over time.

#### Features:

* Daily/weekly activity
* Score trends
* Completion trends

---

### 4.8 Class Management (Teacher Only)

#### Features:

* Create class
* Add/remove students
* Group assignments

---

## 5. 🧱 Technical Architecture (AWS)

### Services:

* API Gateway
* AWS Lambda
* DynamoDB
* Cognito
* S3 (for report exports)

---

## 6. 🗄️ Data Model (High-Level)

---

### 6.1 Users Table

```
PK: USER#<id>
SK: METADATA

Attributes:
- role (TEACHER | PARENT | STUDENT)
- name
- email
```

---

### 6.2 Student Mapping Table

```
PK: STUDENT#<id>
SK: TEACHER#<id> | PARENT#<id>
```

---

### 6.3 Assignments Table

```
PK: ASSIGNMENT#<id>
SK: STUDENT#<id>

Attributes:
- worksheetId
- assignedBy
- dueDate
- status
```

---

### 6.4 Attempts Table

```
PK: STUDENT#<id>
SK: WORKSHEET#<id>#ATTEMPT#<id>

Attributes:
- score
- timeSpent
- answers
```

---

### 6.5 Reports Table (Optional)

```
PK: REPORT#STUDENT#<id>
SK: DATE#<timestamp>
```

---

## 7. 🔄 Module Integration

| Module              | Integration                 |
| ------------------- | --------------------------- |
| Worksheet Generator | Assign generated worksheets |
| Question Bank       | Fetch reusable questions    |
| Online Solver       | Retrieve attempt data       |
| Reporting Engine    | Generate analytics          |

---

## 8. ⚠️ Key Design Considerations

### 8.1 Reporting Strategy

* Real-time (flexible but slower)
* Precomputed (fast but complex)

**Recommendation:** Hybrid approach

---

### 8.2 Role Restrictions

* Parent access must be limited
* Teacher has broader control

---

### 8.3 Assignment Storage

* Store worksheet reference, not duplicate data

---

## 9. 🚀 Future Enhancements

* AI Tutor / Chat assistant
* Personalized learning paths
* Gamification (badges, streaks)
* PDF report export
* School-level dashboards

---

## 10. ❗ Known Limitation

* Offshore users may not be able to track real-time progress (to be addressed in future versions)

---

If you want, next step should be **DynamoDB production-grade design (with GSIs + access patterns)**—that’s where most systems either scale… or break.
