# Pi Coding Agent Configuration Plan

## Objective

Optimize the local Pi coding agent configuration while keeping repository-owned configuration and runtime state separate.

## Assumptions

- `~/.agents/AGENTS.md` remains the canonical global agent guidance file.
- `~/.pi/agent/AGENTS.md` should continue pointing at the canonical global guidance.
- Pi runtime state, auth, trust decisions, sessions, npm/git package caches, and transcripts must stay local-only.
- The Pie repository is the canonical source for portable Pi configuration. Dotfile managers should not own the same files.

## Changes

Current durable Pi configuration now includes:

1. `~/.pi/agent/settings.json` as the explicit global baseline:
   - keep provider/model defaults;
   - keep `defaultThinkingLevel` at `high`;
   - keep `hideThinkingBlock` set to `false`;
   - set the default theme to `catppuccin-mocha`;
   - load `extensions/starship-statusline.ts`;
   - load `extensions/display-policy.ts`;
   - opt out of install/update telemetry;
   - keep global package loading empty;
   - keep auto-compaction enabled with more recent raw context retained.
2. Store only durable Pi config in this repository under `agent/`:
   - `agent/settings.json`;
   - `agent/keybindings.json`;
   - `agent/extensions/*.ts`;
   - `agent/prompts/*.md`;
   - `agent/themes/*.json`;
   - `agent/docs/*.md`.
3. Keep runtime state out of this repository:
   - auth and trust files;
   - sessions, transcripts, and runtime history;
   - package caches and generated package state.
4. Keep chezmoi and Mackup from owning the same Pi files.

## Current Validation Status

- `PI_OFFLINE=1 pi --help` may warn about `~/.pi/agent/settings.json.lock` in a read-only sandbox, because Pi uses a lock directory while reading global settings. The same command succeeds without that warning in the normal home-write environment, and no stale lock directory remains afterward.
- A TUI startup smoke test confirmed that Pi loads the global prompts, extensions, Catppuccin themes, and status footer without crashing.
- The `/display` slash-command path still needs a clean manual interactive smoke test. A PTY-driven attempt submitted the text as a normal prompt, so it should not be counted as command-path validation.

## Direction 1: Prompt Templates

Add low-risk global prompt templates for frequent workflows:

- `review.md` for code-review-only inspection.
- `commit.md` for a focused conventional-commit workflow.
- `pr-update.md` for GitHub PR metadata updates with bilingual body rules.

## Direction 2: Skill Source De-Duplication

Keep `~/.agents/skills` as the canonical user-level skill source. Pi already discovers that directory, so `~/.pi/agent/skills` should not mirror it with symlinks.

Remove Pi-local skill symlinks from the home target and do not add them to this repository. This keeps skill ownership in one place and avoids duplicate discovery warnings.

## Direction 3: Footer Extension Signal

Keep the existing footer extension small and operational:

- show the current project directory name as the first status segment;
- mark the project with `*` when `git status --short` reports local changes;
- cache the dirty check briefly so the footer does not shell out on every render.

This makes Pi's current working context visible without adding new workflow hooks or agent behavior.

## Direction 4: Project-Local Profile Boundary

Add a reusable `/pi-profile` prompt template for creating or auditing repository-local `.pi/settings.json` files.

The template keeps the decision conservative:

- inspect repository guidance and existing `.pi` resources first;
- classify candidates as `global reusable`, `project profile`, or `runtime local`;
- skip `.pi/settings.json` when no project-specific override is justified;
- keep project profiles minimal when they are justified.

This creates a repeatable path for per-repo Pi customization without pushing repo-specific defaults into global config.

## Direction 5: Keyboard Shortcuts

Add a minimal user-level `keybindings.json` that keeps Pi close to Claude Code keyboard muscle memory.

Keep this layer narrow:

- keep Pi's existing high-frequency defaults unless a Claude Code alias can be added without conflict;
- do not remap editor movement/history keys that would replace Pi model cycling;
- document conflicts instead of silently overriding them.

Initial Claude Code-aligned aliases:

- `Alt+T` also cycles Pi thinking level, matching Claude Code's extended-thinking muscle memory;
- `Alt+P` also opens the Pi model selector, matching Claude Code's model switch shortcut;
- `Ctrl+J` also inserts a newline, matching Claude Code's terminal-safe newline shortcut;
- `Alt+V` also pastes an image, matching Claude Code's fallback image paste shortcut;
- `Alt+R` opens resume;
- `Alt+N` starts a new session.

Known conflicts or non-mappings:

- `Ctrl+P` / `Ctrl+N`: Claude Code uses these for history navigation, but Pi uses `Ctrl+P` for model cycling, so do not override by default.
- `Ctrl+L`: Claude Code redraws the screen, but Pi uses it for model selection, so keep Pi's default and add `Alt+P` instead.
- `Ctrl+T`: Claude Code toggles the task list, while Pi toggles thinking blocks, so keep Pi's default.
- `Alt+T`: do not bind it to session tree; use Pi's existing double-Escape tree behavior instead.
- Claude Code `Ctrl+X` chords are not modeled in Pi's simple keybinding JSON.

## Direction 6: Package and Update Boundary

Keep the global Pi package layer empty by default. Add `/pi-package-audit` as the workflow for future package decisions instead of installing packages speculatively.

Current state:

- global `settings.packages` is `[]`;
- global `~/.pi/agent/git` has only its `.gitignore`;
- no global npm package install directory is active.

Package policy:

- update Pi itself separately from packages;
- audit one package or package family at a time;
- prefer project-local packages for repo-specific behavior;
- pin git packages to tags or commits when reproducibility matters;
- keep package runtime directories out of version control.

## Direction 7: Display Defaults

Keep Pi's output display biased toward thinking, not tool detail noise.

Add `extensions/display-policy.ts` as a small global extension:

- collapse tool and operation details on session start;
- collapse tool and operation details again at the start of each new turn;
- keep `hideThinkingBlock` set to `false`, so thinking remains visible;
- provide `/display` to manually reset the display to collapsed tool details.

This leaves `Ctrl+O` available for temporary expansion when the tool details matter.

## Direction 7.5: Theme Family

Use a Catppuccin theme family for Pi's global TUI theme layer.

Current state:

- `catppuccin-latte` is available for light environments;
- `catppuccin-frappe` is available as a softer dark option;
- `catppuccin-macchiato` is available as a mid-contrast dark option;
- `catppuccin-mocha` is the default dark theme.

The theme files are plain Pi JSON themes under `~/.pi/agent/themes/`. They do not change agent behavior and can be switched from `/settings`.

## Direction 8: Session Checkpoints and Compaction

Keep Pi's long-session behavior conservative: preserve more recent raw context, and make durable checkpoints an explicit workflow.

Settings:

- keep auto-compaction enabled;
- keep `reserveTokens` at `16384` for response headroom;
- raise `keepRecentTokens` from `20000` to `32768` so compaction keeps more recent unsummarized context.

Add `/checkpoint` as a global prompt template:

- summarize the active goal and current state;
- preserve durable decisions, important files, validation, and open questions;
- produce a resume prompt for fresh-session continuation;
- avoid file edits unless explicitly requested.

Do not replace Pi's default compaction implementation with a custom compaction extension. The built-in path keeps full JSONL history, supports `/tree`, and has a documented extension hook if deeper customization becomes necessary later.

## Direction 9: Best-Practice Evidence Tiers

Do not present the local Pi setup as generic Pi best practices without evidence.

Add an evidence map and a reusable `/pi-best-practices` prompt template:

- classify choices as `official mechanism`, `official direction`, `community pattern`, `personal preference`, or `experimental`;
- use Pi official docs and installed local docs before community sources;
- use Tavily for current public evidence when community practice matters;
- keep exact local values separate from general Pi recommendations.

Current evidence check:

- official docs strongly support settings, prompt templates, extensions, packages, sessions, and compaction as customization mechanisms;
- public community signals exist, but they do not yet establish a narrow consensus around exact dotfile values;
- most exact values in this setup are personal tuning layered on top of official Pi mechanisms.

## Direction 10: Session Workflow and Recovery Commands

Add `/pi-session-workflow` as the operational decision layer for long-running Pi sessions.

This template does not change Pi runtime behavior. It standardizes when to use the existing session commands:

- `/checkpoint [focus]` before handoff, long pauses, risky refactors, fresh-session migration, or manual compaction;
- `/compact [focus]` only after durable state is captured or when context pressure is high;
- `/tree` to revisit an earlier point inside the same session tree;
- `/fork` to restart from an earlier user prompt in a separate session file;
- `/clone` to duplicate the current active branch into a separate session file;
- `/resume` or `pi -r` to browse and reopen prior sessions;
- `/session` when exact session file, ID, token/cost state, or persistence status matters.

The recovery boundary remains:

- preserve decisions, file paths, validation state, and next steps in explicit checkpoints;
- keep raw session JSONL local-only;
- do not store sessions, transcripts, or runtime history in this repository.

## Verification

- `jq . ~/.pi/agent/settings.json`
- `jq . ~/.pi/agent/keybindings.json`
- `pi --version`
- `bash scripts/check.sh`
- `PI_AGENT_HOME="$(mktemp -d)" bash scripts/install.sh`
- `find ~/.pi/agent/skills -maxdepth 1 -mindepth 1 -print`
- `find ~/.agents/skills -maxdepth 2 -name SKILL.md -print | sort`
- `PI_OFFLINE=1 pi --help`
- `test -f ~/.pi/agent/prompts/pi-profile.md`
- `test -f ~/.pi/agent/prompts/pi-package-audit.md`
- `test -f ~/.pi/agent/prompts/checkpoint.md`
- `test -f ~/.pi/agent/prompts/pi-best-practices.md`
- `test -f ~/.pi/agent/prompts/pi-session-workflow.md`
- `find ~/.pi/agent/themes -maxdepth 1 -type f -name 'catppuccin-*.json' -print | sort`
- `node --input-type=module -e 'import { getAvailableThemes } from "/opt/homebrew/Cellar/pi-coding-agent/0.79.9/libexec/lib/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js"; ...'`
- `node --input-type=module -e 'import { KeybindingsManager } from "/opt/homebrew/Cellar/pi-coding-agent/0.79.9/libexec/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/keybindings.js"; ...'`
- `PI_OFFLINE=1 pi --help`
