# Learnfyra Worksheet Generation Flow, Question Bank, AI Prompting, and Repeat Control

## 1. Verified Worksheet Generation Flow from Code

This workflow is **bank-first**, not AI-first.
The actual flow in code is driven mainly by `backend/handlers/generateHandler.js` and `src/ai/assembler.js`.

### Step-by-step flow
1. **User selects structured options on the frontend**  
   - Grade, subject, topic, difficulty, question count, format, answer key, etc.  
   - The user is **not typing a raw prompt** to the AI.

2. **Frontend sends `POST /api/generate`**  
   - Request lands in `backend/handlers/generateHandler.js`.

3. **Request is validated**  
   - The handler validates the payload and extracts teacher/student context.

4. **Repeat policy and user history are resolved before any AI call**  
   - `buildStudentKey()` builds the learner identity.
   - `resolveEffectiveRepeatCap()` loads the effective repeat policy.
   - `getSeenQuestionSignatures()` loads prior exposure history.

5. **Question bank is checked first**  
   - `assembleWorksheet()` calls `getQuestionBankAdapter()`.
   - It queries the question bank using:
     - `grade`
     - `subject`
     - `topic`
     - `difficulty`

6. **Banked questions are selected with repeat controls**  
   - The code prefers unseen questions.
   - It applies repeat limits based on prior exposure and allowed repeat percentage.
   - Reuse is tracked using `recordQuestionReuse()`.

7. **Same-user 80/20 dedup logic is applied**  
   - In `src/ai/assembler.js`, the code enforces a practical rule:
     - target at least **80% unseen questions**
     - allow up to **20% seen/old questions** when needed
   - This is currently implemented via:
     - `const minUnseen = Math.ceil(questionCount * 0.8)`

8. **If the bank is enough, no AI call is made**  
   - Result = `bank-only` worksheet.

9. **If the bank is partially enough, AI generates only the missing questions**  
   - Result = `mixed` worksheet.
   - New AI-generated questions are validated and stored back into the bank.

10. **If the bank is empty, AI generates the full worksheet**  
    - Result = `ai-only` worksheet.

11. **Prompt builder prepares the AI request only for missing questions**  
    - `buildSystemPrompt()`
    - `buildUserPrompt()`
    - `buildStrictUserPrompt()` for retries/stricter recovery

12. **Model tier is selected based on complexity**  
    - `pickModel()` in `src/ai/assembler.js` chooses:
      - `LOW_COST_MODEL` for small gap fills
      - `CLAUDE_MODEL` as default
      - `PREMIUM_MODEL` for large/hard requests

13. **AI response is validated and normalized**  
    - JSON extraction
    - schema validation
    - question validation
    - answer normalization

14. **Worksheet is exported and stored**  
    - PDF/DOCX/HTML export
    - S3/DynamoDB/local storage updates
    - response metadata returned to frontend

15. **Exposure history is recorded for future reuse control**  
    - `recordExposureHistory()` stores what the learner has already seen.

---

## 2. Question Bank and Reuse Logic

### ✅ What the code is doing now
The question bank is definitely part of the real workflow.

### Verified code path
- `backend/handlers/generateHandler.js`
- `src/ai/assembler.js`
- `src/questionBank/index.js`
- `src/questionBank/reuseHook.js`
- `src/ai/repeatCapPolicy.js`

### How it works
- The system first tries to pull matching questions from the bank.
- If enough matching questions exist, the worksheet can be served entirely from the bank.
- If not enough exist, only the missing count is sent to AI.
- Any new valid AI questions are added back into the bank for future reuse.
- Banked question reuse is incremented with `reuseCount`.

### Same-user repeat handling
There are **two related controls** in the code:

1. **Admin-configurable repeat cap policy**
   - Defined in `backend/handlers/adminHandler.js`
   - Default:
     - `repeatCapPolicy.defaultPercent = 10`
   - Override precedence:
     - `student > parent > teacher > default`

2. **Hardcoded 80/20 same-user rule in assembler**
   - Defined in `src/ai/assembler.js`
   - It tries to keep at least **80% unseen** questions for the same user.
   - It allows up to **20% already-seen** questions when required.

> So your understanding is correct: the workflow does check the question bank and also considers whether similar questions were already served to the same learner.

---

## 3. AI Prompt Structure and Current Multi-Model Support

### Prompting behavior
Because the user only selects frontend options, Learnfyra builds the prompt internally.
The AI is not receiving a freeform teacher prompt from the UI in this flow.

### Prompt builder files
- `src/ai/promptBuilder.js`
- `buildSystemPrompt()`
- `buildUserPrompt()`
- `buildStrictUserPrompt()`

### Prompt content includes
- grade
- subject
- topic
- difficulty
- question count
- required structure/schema
- standards alignment expectations
- answer/explanation requirements

### Current multi-model behavior in code
The current implementation is **multi-tier model routing**, primarily within the Anthropic path.
It is **not yet a fully open provider-routing workflow in this generation path**.

#### Current routing logic
- **Low-cost model** → small missing counts
- **Default model** → normal generation
- **Premium model** → hard or large requests

This is controlled by:
- `src/ai/assembler.js` → `pickModel()`
- `backend/handlers/adminHandler.js` → `modelRouting` policy object

---

## 4. Important Gap Found in Current Code

### Gap
The **20% old-question allowance is not fully admin-driven yet**.

### What is already admin-configurable
- Repeat cap policy exists in admin policy handling.
- Admin endpoints already support repeat-cap policy and overrides.

### What is still hardcoded
- The same-user **80/20 rule** is still hardcoded in `src/ai/assembler.js`:

```js
const minUnseen = Math.ceil(questionCount * 0.8);
```

### Recommendation
To fully match the product expectation, this should be changed so that the unseen/seen split is derived from the effective admin setting, for example:

```js
const minUnseen = Math.ceil(questionCount * ((100 - effectiveRepeatCapPercent) / 100));
```

That would make the “20% repeat allowed” rule truly configurable from Admin instead of being fixed in code.

---

## 5. ASCII Workflow Diagram

```text
+-----------------------+
| Teacher / Frontend UI |
| selects fixed options |
+-----------------------+
           |
           v
+-------------------------------+
| POST /api/generate            |
| backend/handlers/             |
| generateHandler.js            |
+-------------------------------+
           |
           v
+-----------------------------------------------+
| Validate request + identify teacher/student    |
| buildStudentKey()                              |
| resolveEffectiveRepeatCap()                    |
| getSeenQuestionSignatures()                    |
+-----------------------------------------------+
           |
           v
+-----------------------------------------------+
| assembleWorksheet()                            |
| src/ai/assembler.js                            |
+-----------------------------------------------+
           |
           v
+-----------------------------------------------+
| Query Question Bank first                      |
| qb.listQuestions(grade, subject, topic, diff) |
+-----------------------------------------------+
           |
           v
      +----+-----------------------------------+
      | Are enough suitable unseen questions?  |
      +----+-----------------------------------+
           | yes                                | no / partial
           v                                    v
+-----------------------------+      +----------------------------------+
| Build bank-only worksheet   |      | Keep banked questions            |
| No AI call needed           |      | Calculate missing count          |
+-----------------------------+      +----------------------------------+
                                               |
                                               v
                              +----------------------------------------+
                              | Build AI prompt for missing questions  |
                              | buildSystemPrompt()                    |
                              | buildUserPrompt() / strict retry       |
                              +----------------------------------------+
                                               |
                                               v
                              +----------------------------------------+
                              | pickModel() chooses model tier         |
                              | low / default / premium                |
                              +----------------------------------------+
                                               |
                                               v
                              +----------------------------------------+
                              | AI generates only missing questions    |
                              | validate + normalize output            |
                              +----------------------------------------+
                                               |
                                               v
                              +----------------------------------------+
                              | Store new questions back to bank       |
                              | addIfNotExists()                       |
                              +----------------------------------------+
                                               |
                     +-------------------------+------------------------+
                     |                                                  |
                     v                                                  v
        +-------------------------------+                +--------------------------------+
        | recordQuestionReuse()         |                | recordExposureHistory()        |
        | increment banked reuse count  |                | save what learner has seen     |
        +-------------------------------+                +--------------------------------+
                     |
                     v
        +-----------------------------------------------+
        | Export worksheet + upload + return response   |
        +-----------------------------------------------+
```

---

## 6. Summary for Business Understanding

### Corrected business summary
When a worksheet is requested:
1. Learnfyra **first checks the question bank** for the requested combination.
2. It also checks whether those questions were already served to the same learner.
3. It tries to keep most questions unseen.
4. It allows limited carry-forward of older questions.
5. Only the missing questions are generated by AI.
6. New AI questions are saved back into the bank for future use.

### Current status against your requirement
- **Question bank in workflow:** ✅ Present in code
- **Reuse tracking:** ✅ Present in code
- **Admin repeat-cap policy:** ✅ Present in code
- **Exactly 20% admin-configurable same-user carry-forward:** ⚠️ Partially implemented, but the 80/20 rule is still hardcoded and should be aligned to admin config

---

## References Verified from Code
- `backend/handlers/generateHandler.js`
- `src/ai/assembler.js`
- `src/ai/repeatCapPolicy.js`
- `src/questionBank/index.js`
- `src/questionBank/reuseHook.js`
- `backend/handlers/adminHandler.js`
