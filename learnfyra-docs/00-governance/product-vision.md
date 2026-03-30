# Product Vision

## Platform Summary

Learnfyra is an AI-powered, USA curriculum-aligned worksheet generation platform for Grades 1–10. It runs as both a local CLI and a serverless web application deployed on AWS. Students can generate, download, and solve worksheets online with instant scoring and answer review.

## Core Value Proposition

- Teachers generate high-quality, standards-aligned worksheets in under 60 seconds.
- Students solve worksheets online, receive instant scored feedback with explanations, and track progress over time.
- Parents monitor child learning and submit offline scores for paper-based practice.
- The system avoids repetitive questions by reusing a persistent Question Bank and enforcing per-student repeat caps.

## Target Users

| Role | Primary Goal |
|---|---|
| Student (Grades 1–10) | Practice skills, receive instant feedback, build study habits |
| Teacher | Generate and assign worksheets, track class performance, identify struggling students |
| Parent | Monitor child progress, reinforce weak areas, celebrate wins |
| Admin | Manage platform health, AI model routing, user accounts, and content quality |

## Design Philosophy

**Joyful meets trustworthy.** Learnfyra occupies the intersection neither EduSheets.io (too corporate) nor EduSheetHub.com (too amateur) currently holds. The experience should feel like the best classroom: organized, colorful, energetic, and safe.

**Personality pillars:**
- Energetic — bright primaries, celebratory interactions
- Trustworthy — clear hierarchy, professional structure
- Joyful — rounded shapes, multi-color accents
- Educational — standards-aligned, outcome-driven

## Curriculum Alignment

- Math / ELA: CCSS (Common Core State Standards)
- Science: NGSS (Next Generation Science Standards)
- Social Studies: C3 Framework
- Health: NHES (National Health Education Standards)

All topics verified against official curriculum standards. No content generated outside the verified curriculum map.

## Phase 1 Goals (Current)

1. Multi-role authentication (student, teacher, parent) with Google OAuth and local accounts.
2. Intelligent worksheet generation using a Question Bank with AI gap-fill.
3. Online solve flow with timed and untimed modes and instant scoring.
4. Student progress tracking and teacher/parent analytics.
5. AWS serverless deployment with CDK-managed infrastructure.

## Phase 2+ Goals (Deferred)

- Rewards, gamification, and engagement system (points, badges, streaks).
- Super Admin control plane for AI model routing and platform operations.
- Angular frontend redesign with student and teacher role dashboards.
- Completion certificates (persistent, optionally branded and verifiable).
- Multi-provider account linking (GitHub/Microsoft OAuth).
- LMS SSO and multi-tenant school federation.
