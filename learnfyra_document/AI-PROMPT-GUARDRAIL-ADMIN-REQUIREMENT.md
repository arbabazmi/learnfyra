# Requirement: AI Prompt, Guardrail, and Admin Controls

## Overview
Learnfyra must ensure that all AI-generated worksheet content is safe, age-appropriate, and free from harmful, biased, or inappropriate material. The platform serves Grade 1–10 students, so guardrails must be context-aware, platform-specific, and efficient in token usage.

## Problem Statement
Current worksheet generation does not explicitly enforce guardrails to prevent:
- Model prompt injection (malicious prompt manipulation)
- Hallucinated or factually incorrect content
- Harmful, offensive, or age-inappropriate material
- Biased, discriminatory, or culturally insensitive content

## Requirements
1. **Prompt Engineering Guardrails (Platform- and Use-Dependent)**
   - All prompts sent to the AI must include concise, explicit instructions to avoid harmful, inappropriate, or biased content.
   - Prompts must dynamically specify:
     - The target grade, subject, and age group (e.g., “for Grade 1 Math, age 6–7”).
     - That content must be safe, factual, and suitable for US Grade 1–10 students.
     - To avoid references to violence, politics, religion, mature themes, or sensitive scenarios.
   - Guardrail instructions should be as brief as possible to minimize token usage.
   - If any user-supplied text is ever allowed in the future, prompt injection risks must be re-evaluated and mitigated.

2. **Output Validation (Context-Aware)**
   - All AI responses must be programmatically scanned for:
     - Profanity, hate speech, or offensive language
     - Sensitive or mature topics
     - Factual errors (where possible)
   - Validation filters must use grade and subject context (e.g., stricter for lower grades).
   - Any worksheet failing validation must be rejected and regenerated.

3. **Content Moderation**
   - Integrate a content moderation layer (e.g., OpenAI Moderation API, AWS Comprehend, or custom filters) to scan all generated questions, answers, and explanations.
   - Moderation must be context-sensitive (grade/subject/age group).
   - Log and review all flagged content for manual QA.

4. **Bias and Fairness**
   - Prompts must instruct the model to avoid stereotypes and ensure inclusivity.
   - Regularly audit generated content for bias and update prompts/filters as needed.

5. **Audit and Logging**
   - Maintain logs of all prompt/response pairs and moderation results for compliance review.
   - Provide a mechanism for teachers to report inappropriate content.

6. **Fallback and Retries**
   - If a model produces unsafe or invalid content, automatically retry with a more restrictive prompt or alternate model.

7. **Super Admin / Platform Admin Controls**
   - Only Super Admin or Platform Admin (not teachers or parents) must have the ability to:
     - View and update the AI prompt templates and guardrail instructions used for worksheet generation.
     - Change or configure the active AI model used for worksheet generation (e.g., switch between Anthropic Claude, OpenAI GPT, etc.) as platform needs evolve.
   - All changes to prompts, guardrails, or model selection must be logged for audit and compliance.

## Acceptance Criteria
- No worksheet delivered to students contains harmful, offensive, or age-inappropriate content.
- All prompts and outputs are logged and can be audited.
- Content moderation is enforced on every worksheet before delivery, using grade/subject context.
- Teachers have a way to report and escalate issues.
- Only Super Admin/Platform Admin can update prompts, guardrails, or AI model selection.

## References
- [OpenAI Moderation API](https://platform.openai.com/docs/guides/moderation)
- [AWS Comprehend](https://aws.amazon.com/comprehend/)
- [CCSS/NGSS Standards](https://www.corestandards.org/)

---

**This requirement is mandatory for all future worksheet generation and must be implemented before any public or production release. Guardrails must be context-aware, platform-specific, and token-efficient.**
