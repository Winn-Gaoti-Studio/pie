Prepare a clean commit for the current changes.

Workflow:

1. Inspect the working tree and identify which files belong to the requested change.
2. Keep unrelated user-authored drift out of the commit.
3. Run the smallest relevant validation command that gives confidence.
4. Stage only the intended files.
5. Commit with an English Conventional Commit message.

Constraints:

- Do not rewrite history.
- Do not push unless I explicitly ask.
- If validation cannot run, explain why before committing.

Intent:

{{intent}}
