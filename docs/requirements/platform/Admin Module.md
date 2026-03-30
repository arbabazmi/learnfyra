Here’s a comprehensive **Admin Module Requirement Document** for LearnFyra, based on your input and the existing module architecture and requirements. I structured it to include functional scope, data needs, AI model management, and operational responsibilities. I made it ready to be added as a markdown file in your requirements folder.

---

# 📘 LearnFyra – Admin Module Requirements

## Module: Admin & Portal Management (ADMIN)

### 🎯 Purpose

The Admin Module provides system administrators with full visibility and control over users, AI models, worksheets, and operational configurations. This module ensures platform health, content quality, and user management in a centralized portal.

---

## 🧩 Functional Requirements

### 1. User Management

* **FR-ADMIN-001:** Admin can view a list of all users, including students, teachers, and parents.
* **FR-ADMIN-002:** Admin can search/filter users by:

  * Role (Student/Teacher/Parent)
  * Registration date
  * Last login
  * Progress metrics (average score, weak topics)
* **FR-ADMIN-003:** Admin can deactivate/reactivate user accounts.
* **FR-ADMIN-004:** Admin can manually assign or reset roles (Student/Teacher/Parent).
* **FR-ADMIN-005:** Admin can link or unlink parent and student accounts manually if needed.

### 2. AI Model Management

* **FR-ADMIN-006:** Admin can view all AI models available for worksheet generation.
* **FR-ADMIN-007:** Admin can select default AI model per grade/subject/topic.
* **FR-ADMIN-008:** Admin can configure fallback models and thresholds for quality scoring.
* **FR-ADMIN-009:** Admin can monitor AI usage statistics:

  * Number of questions generated per model
  * Token usage per model
  * Model success/failure metrics
* **FR-ADMIN-010:** Admin can temporarily disable an AI model for maintenance or quality issues.

### 3. Worksheet & Content Oversight

* **FR-ADMIN-011:** Admin can view generated worksheets, including:

  * Worksheet metadata (grade, subject, topic, difficulty)
  * Generated questions and associated AI model
  * Completion status and usage statistics
* **FR-ADMIN-012:** Admin can flag or approve questions for quality or correctness.
* **FR-ADMIN-013:** Admin can override student repeat-cap limits for specific scenarios.

### 4. Portal & Configuration Management

* **FR-ADMIN-014:** Admin can configure system-wide settings:

  * Max worksheet questions per grade
  * Default AI models per curriculum standard
  * Student progress tracking retention
  * Notification templates (emails for verification or alerts)
* **FR-ADMIN-015:** Admin can monitor platform health:

  * Lambda function errors
  * DynamoDB throttling
  * S3 bucket usage
* **FR-ADMIN-016:** Admin can view audit logs for critical operations:

  * User account changes
  * Worksheet generation requests
  * AI model updates
* **FR-ADMIN-017:** Admin can perform bulk operations:

  * Bulk deactivate/reactivate accounts
  * Bulk assign AI model or grade/topic overrides

### 5. Reports & Analytics

* **FR-ADMIN-018:** Admin can generate reports for:

  * User activity per role
  * Worksheet generation per AI model
  * Student progress across grades or subjects
  * Operational metrics (API usage, errors)
* **FR-ADMIN-019:** Admin reports can be exported in CSV or PDF formats.

### 6. Security & Access Control

* **FR-ADMIN-020:** Only Admin role users can access this module.
* **FR-ADMIN-021:** All admin actions are logged with timestamp and userId.
* **FR-ADMIN-022:** Sensitive operations (delete user, disable AI model) require confirmation.

---

## 🗄️ Data Model Requirements

### Users Table (DynamoDB)

* `PK = USER#{userId}`, `SK = PROFILE`
* Attributes: `userId, email, role, createdAt, lastLogin, linkedChildIds, activeFlag`
* Admin filters rely on GSI: `GSI1PK = ROLE#{role}`, `GSI1SK = CREATED#{createdAt}`

### AI Config Table

* `PK = CONFIG#AI_MODEL`, `SK = METADATA`
* Attributes: `modelName, grade, subject, fallbackModel, status, tokenUsage, qualityScoreThreshold`

### Worksheet Table

* Access by admin: `worksheetId, grade, subject, topic, questions[], modelUsed, createdAt, usageCount`

### Audit Log Table

* `PK = AUDIT#{timestamp}`, `SK = OPERATION#{operationId}`
* Attributes: `performedBy, operationType, targetId, details, timestamp`

---

## 🧱 Architecture Considerations

* Built as a web-based portal (React + AWS Cognito for auth)
* Serverless backend (Lambda + API Gateway)
* Admin dashboards fetch metrics via DynamoDB queries and CloudWatch metrics
* All AI model configuration changes trigger logs for auditing
* S3 holds worksheets and associated metadata; admin can preview/download

---

## 🚀 Future Enhancements (Phase 2+)

* Role-based sub-admins (e.g., content admin, system ops)
* AI model performance heatmaps per subject/grade
* Question quality review workflow
* Alerts for low-quality or flagged questions
* Multi-language admin portal

---

## 📌 Summary

The Admin module ensures operational oversight, AI model management, user management, and portal configuration. It is critical for maintaining platform quality, supporting teachers/parents, and managing AI-powered content generation.

