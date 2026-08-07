---
description: Create a durable checkpoint for a long Pi session
argument-hint: "[focus]"
---
Create a compact checkpoint for this Pi session.

Focus: ${1:-current task} ${@:2}

Use the current conversation and repository state only as needed. Do not edit files unless I explicitly ask.

Output in this exact structure:

## Goal
One or two sentences describing the active objective.

## Current State
- Active branch or working directory, if relevant.
- What is already done.
- What is still in progress.

## Key Decisions
- Durable decisions that should survive compaction, resume, or handoff.

## Important Files
- Files read or changed that matter for continuing.
- Include exact paths when available.

## Validation
- Commands already run and their results.
- Commands still worth running.

## Open Questions
- Only real unresolved questions. Say `None` if there are none.

## Next Steps
1. The immediate next action.
2. The next validation.
3. The next handoff or commit action, if relevant.

## Resume Prompt
A short prompt that can be used to resume the task in a fresh Pi session.
