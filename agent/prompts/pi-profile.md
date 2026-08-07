Design or audit a project-local Pi profile for the current repository.

Goal:

{{goal}}

Workflow:

1. Inspect the current repository before changing anything:
   - current working directory and git status;
   - nearest `AGENTS.md`;
   - nearest `CLAUDE.md` only when no equivalent `AGENTS.md` exists;
   - existing `.pi/settings.json` and `.pi/{extensions,skills,prompts,themes}` if present;
   - relevant build, test, lint, package, and project metadata files.
2. Classify every candidate setting or resource:
   - `global reusable`: belongs in user-level agent config, not this repo;
   - `project profile`: useful only for this repo and safe to keep under `.pi/`;
   - `runtime local`: sessions, trust decisions, auth, caches, generated files, logs, and local-only state.
3. Decide whether a project profile is warranted.
   - If not warranted, do not create `.pi/settings.json`; explain the minimal rationale.
   - If warranted, create or update only the smallest useful `.pi/settings.json`.
4. Keep `.pi/settings.json` focused on Pi behavior for this repository:
   - project-specific `defaultThinkingLevel`;
   - project-specific `enabledModels`;
   - project-local `extensions`, `skills`, `prompts`, or `themes`;
   - project-local `packages` only when the package is intentionally repo-owned and pinned.
5. Validate after changes:
   - `jq . .pi/settings.json` when the file exists;
   - `PI_OFFLINE=1 pi --approve --help`;
   - the smallest relevant repo validation command if behavior changed.

Constraints:

- Do not edit global Pi config, global agent guidance, or Pie repository files unless I explicitly ask.
- Do not duplicate globally discovered resources such as user-level skills or prompt templates.
- Do not store auth, sessions, trust decisions, package caches, transcripts, logs, or generated runtime state in the repo.
- Do not add project-local extensions or packages unless their behavior is necessary for this repo.
- Keep docs, commit messages, code identifiers, and repository artifacts in English.

Output:

- State whether a project-local Pi profile was created, updated, or skipped.
- If changed, list the exact files and validation results.
- If skipped, list the one or two future signals that would justify adding one.
