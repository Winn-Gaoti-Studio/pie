---
description: Classify Pi configuration choices by evidence strength
argument-hint: "[scope]"
---
Audit Pi configuration choices for evidence strength.

Scope: ${1:-current Pi configuration} ${@:2}

Use local files first, then Tavily-backed web research when the answer depends on current public docs or community practice.

Classify every recommendation as one of:

- `official mechanism`: documented Pi behavior or typed API.
- `official direction`: encouraged by Pi docs/homepage, but exact implementation is local.
- `community pattern`: visible in third-party public Pi usage, package, article, or extension.
- `personal preference`: local workflow, display preference, migration muscle memory, or dotfiles governance.
- `experimental`: possible through Pi APIs/packages but not proven locally.

Workflow:

1. Inspect the relevant local Pi files:
   - `~/.pi/agent/settings.json`
   - `~/.pi/agent/keybindings.json`
   - `~/.pi/agent/extensions/`
   - `~/.pi/agent/prompts/`
   - project `.pi/` files when present.
2. Check Pi official documentation or local installed docs before relying on community sources.
3. Use Tavily for current public evidence when needed:
   - official Pi docs and GitHub first;
   - third-party extension repositories, package catalog entries, articles, and tutorials second.
4. Keep exact local values separate from general Pi recommendations.
5. Do not change files unless I explicitly ask for implementation.

Output:

## Finding
One-paragraph answer to whether this is a Pi best practice, community pattern, or personal configuration.

## Classification
| Choice | Tier | Evidence | Recommendation |
| --- | --- | --- | --- |

## Sources
- Official sources first.
- Community sources second.

## Next Action
The smallest useful follow-up, if any.
