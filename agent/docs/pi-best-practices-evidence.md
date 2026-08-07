# Pi Configuration Evidence Map

## Purpose

Classify the local Pi configuration as official mechanism, community pattern, personal preference, or experimental. This prevents personal workflow choices from being presented as Pi-wide best practices.

## Evidence Tiers

| Tier | Meaning | Use |
| --- | --- | --- |
| `official mechanism` | Documented in Pi docs, README, source examples, or typed APIs. | Safe to rely on as Pi behavior. |
| `official direction` | Pi docs or homepage encourage the general approach, but not the exact local implementation. | Good default if kept small and reversible. |
| `community pattern` | Public third-party Pi usage, package, article, or extension demonstrates the pattern. | Useful signal, not a standard. |
| `personal preference` | Driven by local workflow, muscle memory, or display taste. | Keep explicit and easy to change. |
| `experimental` | Possible through Pi extension/package APIs but not yet proven locally. | Audit before installing or making persistent. |

## Source Notes

- Pi settings are explicitly JSON-based with global `~/.pi/agent/settings.json` and project `.pi/settings.json`, with project settings overriding global settings.
- Pi prompt templates are official, loaded from `~/.pi/agent/prompts/*.md`, `.pi/prompts/*.md`, packages, settings paths, or CLI paths.
- Pi extensions are official TypeScript modules. Global extensions live under `~/.pi/agent/extensions/`; project-local extensions live under `.pi/extensions/`.
- Pi themes are official JSON resources. Global themes live under `~/.pi/agent/themes/*.json`; project-local themes live under `.pi/themes/*.json`.
- Pi compaction and branch summarization are official mechanisms. Auto-compaction summarizes older content and keeps recent messages; defaults are `reserveTokens: 16384` and `keepRecentTokens: 20000`.
- Pi homepage and docs encourage adapting Pi through extensions, skills, prompt templates, themes, packages, RPC, and SDK rather than forking internals.
- Public community signals exist, including third-party extension collections, articles, package catalog entries, and tutorials, but they do not yet form a narrow consensus around exact dotfile values.

## Current Local Configuration Classification

| Local choice | Tier | Rationale |
| --- | --- | --- |
| Global `~/.pi/agent/settings.json` installed from Pie | official mechanism + personal governance | Pi supports the file; this repository owns the portable source. |
| Project-local `.pi/settings.json` only when justified | official mechanism | Pi documents global vs project settings and override behavior. |
| Prompt templates under `~/.pi/agent/prompts/*.md` | official mechanism | Pi documents file-based prompt templates and slash expansion. |
| `/review`, `/commit`, `/pr-update`, `/pi-profile`, `/pi-package-audit`, `/checkpoint`, `/pi-best-practices`, `/pi-session-workflow` | official direction + personal workflow | Prompt templates are official; exact workflows are local choices. |
| Extensions under `~/.pi/agent/extensions/*.ts` | official mechanism | Pi documents global extension auto-discovery and reload behavior. |
| `display-policy.ts` collapsing tool details | official mechanism + personal preference | Uses documented `ctx.ui.setToolsExpanded`; default collapsed display reflects local preference. |
| `starship-statusline.ts` | official mechanism + personal preference | Uses extension UI/status APIs; exact footer content is local. |
| Catppuccin theme family under `~/.pi/agent/themes/*.json` | official mechanism + personal preference | Pi themes are official; Catppuccin flavor choice and token mapping are local visual preferences. |
| `theme: "catppuccin-mocha"` | official mechanism + personal preference | Pi supports selecting a named theme; Mocha is the current local dark baseline. |
| `defaultThinkingLevel: high` | personal preference | Pi supports the setting; level choice is workload-specific. |
| `hideThinkingBlock: false` | official mechanism + personal preference | Pi documents the setting; visible thinking reflects local preference. |
| CC-like keybindings | personal preference | Pi supports keybindings; mapping is driven by migration from Claude Code. |
| Empty global `packages` | personal governance | Pi supports packages; keeping global packages empty is a conservative local policy. |
| `keepRecentTokens: 32768` | official mechanism + personal tuning | Pi supports the setting; 32768 is a local long-session preference above the official default. |
| `/checkpoint` before long handoffs | community-adjacent workflow | Public Pi materials emphasize sessions/compaction/extensibility, but this exact checkpoint template is local. |
| Custom compaction extension not installed | conservative engineering choice | Pi supports custom compaction, but the built-in behavior is simpler and already documented. |

## Local Validation Notes

- `PI_OFFLINE=1 pi --help` can emit a `settings.json.lock` warning in a read-only sandbox. In a normal home-write environment it runs without that warning and leaves no stale lock directory.
- TUI startup has been smoke-tested with the current global prompts, extensions, Catppuccin themes, and status footer loaded.
- The `/display` slash command is implemented as a local display-control convenience, but its command-path validation remains manual because the PTY smoke attempt submitted it as normal prompt text.

## Practical Rule

When adding Pi configuration:

1. Prefer official mechanisms first: settings, prompt templates, extensions, packages, project-local profiles.
2. Keep global config small and stable.
3. Classify each new behavior before persisting it.
4. Treat exact numbers, keybindings, UI defaults, and prompts as personal preferences unless backed by repeated external usage.
5. Use project-local `.pi/` for repo-specific behavior.
6. Keep runtime state, sessions, package caches, logs, and generated files out of this repository.

## References

- [Pi Settings](https://pi.dev/docs/latest/settings)
- [Pi Prompt Templates](https://pi.dev/docs/latest/prompt-templates)
- [Pi Extensions](https://pi.dev/docs/latest/extensions)
- [Pi Themes](https://pi.dev/docs/latest/themes)
- [Pi Compaction](https://pi.dev/docs/latest/compaction)
- [Pi homepage](https://pi.dev)
- [Pi GitHub repository](https://github.com/earendil-works/pi)
- [pi-agent-extensions](https://github.com/rytswd/pi-agent-extensions)
- [Pi package catalog](https://pi.dev/packages)
