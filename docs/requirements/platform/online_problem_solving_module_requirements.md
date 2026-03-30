# 📘 LearnFyra – Online Problem Solving & Assessment Module

## 🎯 Purpose
Enable students to solve worksheets interactively, receive feedback, track progress, and improve learning outcomes through structured assessment and analytics.

---

## 🧠 Core Learning Principle
The system should support a continuous learning loop:

**Attempt → Feedback → Reflection → Improvement → Mastery**

---

## 🧩 Functional Requirements

### 1. Worksheet Attempt Engine
- Start a worksheet
- Auto-save progress
- Resume incomplete attempts
- Submit partially or fully

#### Modes of Attempt
- **Practice Mode**
  - Instant feedback
  - Explanations available
- **Test Mode**
  - No hints or explanations during attempt
  - Score revealed after submission
- **Guided Mode (Future Phase)**
  - Step-by-step hints
  - Controlled explanation reveal

---

### 2. Question Rendering Engine
Support multiple question types:
- MCQ
- Fill in the blanks
- Short answer
- Match the following
- Drag & drop (future)
- Diagram-based (future)

#### Schema-driven Rendering
Questions must be rendered dynamically using a standard schema.

Example:
```json
{
  "type": "MCQ",
  "question": "...",
  "options": ["A", "B", "C"],
  "answer": "A",
  "explanation": "...",
  "metadata": {
    "difficulty": "easy",
    "topic": "fractions"
  }
}
```

---

### 3. Answer Processing Engine
- Validate answers in real-time or on submission
- Store each attempt interaction

#### Tracking Parameters
- Time spent per question
- Number of retries
- Hint usage

---

### 4. Feedback & Explanation Engine
Configurable explanation timing:

| Mode | Explanation Availability |
|------|------------------------|
| Practice | Immediate |
| Test | After submission |
| Guided | Step-based |

---

### 5. Scoring Engine

#### Basic
- Total score
- Correct vs incorrect answers

#### Advanced (Future)
- Weighted scoring
- Time-based scoring
- Partial credit evaluation

---

### 6. Attempt History & Review
Students can:
- View past worksheet attempts
- See score, time taken, and answers
- Review explanations
- Retry worksheets

#### Advanced Feature
- Compare multiple attempts

---

### 7. Progress Tracking
Track performance metrics:
- Accuracy percentage
- Topic-wise performance
- Weak areas
- Time efficiency

---

### 8. Session Tracking
Capture session-level data:
- Start time
- End time
- Idle time
- Drop-off points

---

### 9. EdTech Tools Integration (Future)
Support pluggable tools based on subject and grade:

Examples:
- Math tools (calculator, fraction visualizer)
- English tools (dictionary, grammar helper)
- Science tools (diagram tools)

---

### 10. Teacher/Parent Visibility (Future)
- Access student performance data
- View progress and weak areas
- Monitor attempts and improvement

---

## 🧱 Data Model (High-Level)

### WorksheetAttempt
- attempt_id
- user_id
- worksheet_id
- mode
- status
- start_time
- end_time
- score

### QuestionAttempt
- question_id
- attempt_id
- answer
- is_correct
- time_spent
- hints_used
- attempts_count

### UserProgress
- user_id
- topic
- accuracy
- last_updated

---

## ⚠️ Design Considerations

### 1. Store Full Interaction Data
- Do not store only final answers
- Capture retries, hints, and timing

### 2. Scalability
- Support asynchronous evaluation for complex answers
- Use event-driven processing where needed

### 3. Loose Coupling
- Keep worksheet generator and solving engine independent
- Use standardized schemas for communication

---

## 🚀 Development Phases

### Phase 1 (MVP)
- Solve worksheet
- Submit answers
- Basic scoring
- View results
- Attempt history

### Phase 2
- Multiple modes (Practice/Test)
- Explanation control
- Topic analytics
- Retry and comparison

### Phase 3
- Weak area detection
- Adaptive hints
- Personalized recommendations

### Phase 4
- Interactive tools
- Gamification
- AI tutor integration

---

## 🧠 Strategic Goal

The long-term value lies in:

- Capturing student learning behavior
- Building personalized learning experiences
- Enabling AI-driven tutoring systems

---

## 🌍 Regional Limitation

- Offshore users may not be able to track progress due to system, compliance, or data residency constraints.
- The system should handle this gracefully by:
  - Allowing worksheet solving without progress persistence (stateless mode)
  - Displaying a clear message about limited tracking
  - Ensuring no critical learning functionality is blocked

---

## ❓ Open Questions

1. Should the system behave like an exam platform, practice tool, or AI tutor?
2. Should worksheets be reusable or dynamically regenerated?
3. Should timing constraints be enforced strictly or remain flexible?

---

**End of Document**

