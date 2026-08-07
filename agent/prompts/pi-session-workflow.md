---
description: Choose a Pi session recovery and compaction workflow
argument-hint: "[situation]"
---
Plan the Pi session workflow for the current task.

Situation: ${1:-current long-running task} ${@:2}

Goal:

Choose the smallest reliable sequence of Pi session commands or prompts that preserves recoverability and keeps context quality high.

Do not edit files unless I explicitly ask. If the right next action is an interactive Pi command, tell me the command and why.

Use this decision model:

- Use `/checkpoint [focus]` before handoff, long pauses, risky refactors, fresh-session migration, or manual compaction.
- Use `/compact [focus]` only after durable state is captured or when context pressure is high.
- Use `/tree` when the current session already contains the needed branch or an earlier point is more useful than starting over.
- Use `/fork` when an earlier user prompt is the right restart point and the new path should live in a separate session file.
- Use `/clone` when the current active branch is good and the next step should continue in a separate session file.
- Use `/resume` or `pi -r` when the target session is not active and selection by session list is safer than guessing an ID.
- Use `/session` when exact session file, ID, token/cost state, or current persistence status matters.
- Use `pi --session <path|id>` only when an exact known session should be opened.
- Use `pi --no-session` only for throwaway exploration that should not be persisted.

Recovery principles:

- Prefer a checkpoint over relying on hidden conversation memory.
- Keep exact file paths, validation commands, decisions, and next steps in the checkpoint.
- Keep runtime session files local; do not move sessions into portable dotfiles.
- Treat compaction as lossy even though the full JSONL remains on disk.
- If the task is repo-specific, resume with the same working directory and read project guidance again.
- If the old session is noisy, start fresh with the checkpoint resume prompt plus the relevant files.

Output:

## Recommendation
One paragraph stating the recommended session workflow.

## Command Sequence
List the exact Pi commands or prompts to run, in order.

## Why This Sequence
- Explain why each step is chosen.

## Recovery Boundary
- What must be preserved before compaction or session switch.
- What can be allowed to stay only in session history.

## Fresh Session Resume Prompt
Write a concise prompt that can be pasted into a new Pi session if needed.

## Avoid
- Commands or actions that would add unnecessary risk for this situation.
