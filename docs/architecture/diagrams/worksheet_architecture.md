# Worksheet Generation Platform – Architecture & Requirements (AWS + Bedrock)

## Objective
Build a scalable, cost-efficient worksheet generation platform for Grades 1–10 that:
- Generates high-quality questions and answers
- Avoids repetition using a Question Bank + dynamic assembly
- Supports multi-model strategy (Bedrock)
- Enables admin-controlled model selection
- Stores and reuses content efficiently
- Outputs structured JSON for rendering (PDF, Word, UI)

## Core Design Philosophy
1. Avoid regeneration; reuse questions
2. Separate generation, validation, storage, assembly, rendering
3. Use cheap models by default, premium only when needed

## AWS Architecture
Frontend → API Gateway → Lambda → Step Functions → 
- DynamoDB (Question Bank)
- Bedrock (Generation)
- Lambda (Validation)
- S3 (Storage)
- Assembly Engine → Frontend

## Data Model
Questions Table:
- question_id, grade, subject, topic, difficulty, type
- question, options, answer, explanation
- model_used, created_at

Worksheets Table:
- worksheet_id, metadata, question_ids

## Strategy
- Fetch questions from bank
- Randomize and assemble
- Generate only if needed

## Model Strategy
- Default: Nova Micro
- Fallback: Titan / Llama
- Advanced: Claude Haiku / Sonnet

## Admin Features
- Model selection
- Budget control
- Prompt management
- Validation rules

## Workflow
1. Request
2. Check DB
3. Generate if needed
4. Validate
5. Store
6. Return JSON

## Rendering
- HTML → PDF (Puppeteer)
- docx libraries
- UI rendering

## Cost Optimization
- Cache results
- Batch generation
- Pre-generate common topics

## Monitoring
- CloudWatch logs
- Token usage tracking

## Future
- Personalization
- Difficulty adaptation
- Analytics
