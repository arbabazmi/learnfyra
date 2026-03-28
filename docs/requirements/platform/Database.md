Perfect — here’s a **clean, agent-ready DynamoDB design document** you can copy into a `.md` file and feed directly to your AI coding agent.

---

# 📘 LearnFyra – DynamoDB Table Design (Worksheet Generator System)

## 🎯 Objective

Design scalable, flexible DynamoDB tables for:

* Worksheet generation
* Question bank reuse
* Multi-model AI support
* User and worksheet tracking

---

# 🧠 Design Principles

1. **Access Pattern First (Critical)**
2. **Single Table where possible (but not forced)**
3. **Avoid joins → use denormalization**
4. **Future scalability > current simplicity**
5. **Extensible schema (new question types, AI models)**

---

# 🏗️ TABLE OVERVIEW

| Table Name         | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `QuestionBank`     | Store reusable AI-generated questions      |
| `Worksheet`        | Store generated worksheets                 |
| `WorksheetAttempt` | Track student attempts                     |
| `User`             | User management                            |
| `GenerationLog`    | Track AI generation metadata               |
| `Config`           | Admin configs (AI model, difficulty rules) |

---

# 📦 1. QuestionBank Table (CORE TABLE)

## 🔑 Primary Key

```
PK  = QUESTION#{questionId}
SK  = METADATA
```

## 📄 Attributes

| Attribute     | Type   | Description          |
| ------------- | ------ | -------------------- |
| questionId    | String | UUID                 |
| subject       | String | Math, Science        |
| grade         | Number | 1–10                 |
| topic         | String | Fractions, Algebra   |
| difficulty    | String | Easy / Medium / Hard |
| questionText  | String | Question             |
| options       | List   | MCQ options          |
| correctAnswer | String | Answer               |
| explanation   | String | Explanation          |
| modelUsed     | String | AI model             |
| createdAt     | String | Timestamp            |
| tags          | List   | Search tags          |

---

## 🔍 GSI (Query by Curriculum)

```
GSI1PK = GRADE#{grade}#SUBJECT#{subject}
GSI1SK = TOPIC#{topic}#DIFF#{difficulty}
```

👉 Access:

* Get questions by grade + subject + topic
* Filter by difficulty

---

## 🔍 GSI (Difficulty Based)

```
GSI2PK = DIFFICULTY#{difficulty}
GSI2SK = SUBJECT#{subject}#GRADE#{grade}
```

---

# 📄 2. Worksheet Table

## 🔑 Primary Key

```
PK = WORKSHEET#{worksheetId}
SK = METADATA
```

## 📄 Attributes

| Attribute      | Type                            |
| -------------- | ------------------------------- |
| worksheetId    | String                          |
| userId         | String                          |
| grade          | Number                          |
| subject        | String                          |
| topic          | String                          |
| questions      | List<QuestionId OR Full Object> |
| totalQuestions | Number                          |
| modelUsed      | String                          |
| createdAt      | String                          |
| status         | String (GENERATED / FAILED)     |

---

## 🔍 GSI (User Worksheets)

```
GSI1PK = USER#{userId}
GSI1SK = CREATED#{createdAt}
```

👉 Access:

* Get all worksheets of a user

---

# 🧑‍🎓 3. WorksheetAttempt Table

## 🔑 Primary Key

```
PK = ATTEMPT#{attemptId}
SK = METADATA
```

## 📄 Attributes

| Attribute   | Type   |
| ----------- | ------ |
| attemptId   | String |
| worksheetId | String |
| userId      | String |
| answers     | Map    |
| score       | Number |
| startedAt   | String |
| submittedAt | String |

---

## 🔍 GSI (User Attempts)

```
GSI1PK = USER#{userId}
GSI1SK = ATTEMPT#{submittedAt}
```

---

# 👤 4. User Table

## 🔑 Primary Key

```
PK = USER#{userId}
SK = PROFILE
```

## 📄 Attributes

| Attribute | Type                           |
| --------- | ------------------------------ |
| userId    | String                         |
| name      | String                         |
| email     | String                         |
| role      | String (Student/Teacher/Admin) |
| createdAt | String                         |

---

# 🤖 5. GenerationLog Table

## 🔑 Primary Key

```
PK = GENERATION#{requestId}
SK = METADATA
```

## 📄 Attributes

| Attribute  | Type   |
| ---------- | ------ |
| requestId  | String |
| userId     | String |
| input      | Map    |
| output     | Map    |
| modelUsed  | String |
| tokensUsed | Number |
| latency    | Number |
| status     | String |
| createdAt  | String |

---

# ⚙️ 6. Config Table (Admin Control)

## 🔑 Primary Key

```
PK = CONFIG#{configType}
SK = METADATA
```

## 📄 Example

| configType      | Example       |
| --------------- | ------------- |
| AI_MODEL        | Nova / Claude |
| DIFFICULTY_RULE | Mapping       |
| LIMITS          | Max questions |

---

# 🔄 DATA FLOW

## Worksheet Generation Flow

1. User requests worksheet
2. Check QuestionBank

   * If enough → reuse
   * Else → call AI (Bedrock)
3. Store new questions
4. Create worksheet entry
5. Log generation

---

# 🚀 SCALABILITY STRATEGY

### ✅ Why this won't bottleneck:

* DynamoDB is schema-flexible → add fields anytime
* GSIs can be added later
* Tables are decoupled → evolve independently
* QuestionBank prevents repeated AI cost

---

# ⚠️ FUTURE EXTENSIONS

* Add `Curriculum Board` (CBSE, ICSE, US Common Core)
* Add `Language support`
* Add `Adaptive difficulty`
* Add `Analytics table`

---

# 🧠 CRITICAL DECISIONS (DON’T IGNORE)

### 1. Store Full Question vs QuestionId in Worksheet

* Small scale → store full object
* Large scale → store IDs (recommended)

---

### 2. AI Model Flexibility

Store:

```
modelUsed
promptVersion
```

---

### 3. Avoid This Mistake ❌

* Don’t design tables per feature
* Don’t over-normalize like SQL

---

# ✅ FINAL VERDICT

You are doing it RIGHT:
✔ Designing after module clarity
✔ Thinking about scale early
✔ Keeping AI + DB loosely coupled

---
