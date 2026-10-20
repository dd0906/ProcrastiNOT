---
doc: scope
status: approved
---

# ProcrastiNOT

A student planner that makes a realistic, explainable recovery plan when a fixed commitment disrupts a study day.

## The Unique Kernel
ProcrastiNOT does more than move study blocks: it replans around fixed commitments, completed work, deadlines, available study time, and protected sleep, then explains what changed and is honest when a deadline is at risk. The scheduling decisions use deterministic logic so the core demo is real and explainable, not dependent on an AI API.

## Who It's For
A college student juggling classes and labs alongside assignments and exam preparation. When an unexpected commitment disrupts a carefully planned day, they need help recovering the schedule instead of rebuilding it by hand.

## The Core Loop
The student opens a realistic, editable sample day, adjusts or adds a task or commitment, and triggers a repeatable surprise lab. ProcrastiNOT creates a proposed revised plan, compares it with the original, explains what moved and why, and flags deadlines at risk. The student reviews and approves the revision.

## Inspiration & Identity
The experience should feel calm, warm, modern, and organised—a supportive academic companion, not a strict or guilt-inducing productivity tool. Keep the interface clean and easy to understand in a short demo; any study-buddy personality should complement rather than distract from the planner.

## Why This Matters to the Learner
As a college student, the learner relates to balancing lectures, labs, assignments, exams, and personal time. They want a useful planner that adapts when real life disrupts the plan, without making students feel they have failed or pretending everything can fit.

## What "Working" Looks Like
In a demo under one minute, a student personalises a sample day, adds a repeatable 4–6 PM surprise lab that conflicts with planned study, and sees a genuinely recalculated proposal. A before-and-after comparison makes moved sessions clear and shows what stayed fixed or completed; short explanations and an at-risk warning make the outcome understandable. The student can review and approve the proposed schedule.

## The POC Boundary
Build a sample-centered, single-day proof of concept with editable classes and fixed commitments, study sessions, tasks, deadlines, priorities, available study time, and protected sleep. Let the student add or edit tasks and commitments and trigger the predictable surprise-lab scenario. Implement deterministic scheduling that preserves fixed commitments and completed work, fits study sessions into available time where possible, and reports when deadlines cannot realistically be met. Show the original and proposed plans, what changed and why, and allow review and approval. Prioritise the scheduling engine and a reliable, polished demo over breadth; the PRD and technical specification must define concrete, testable scheduling rules before implementation.

## Later
- A full weekly or multi-day planner instead of the bounded sample-day demonstration.
- Sticky notes, reminders, a study timer, and AI-assisted study materials.
- Authentication and other capabilities not needed to demonstrate rescheduling.
- More developed study-buddy features beyond a calm, supportive tone.

## Explicitly Cut
- A generic to-do list or chatbot in place of the scheduling proof.
- AI/API-generated scheduling decisions: the MVP's rescheduling must be deterministic and explainable.
- A visual-only mock-up that does not actually recalculate a schedule.
