Audit Pi packages and update boundaries for the current scope.

Goal:

{{goal}}

Workflow:

1. Inspect the active scope before changing anything:
   - global `~/.pi/agent/settings.json`;
   - project `.pi/settings.json` if present;
   - `pi list` when available;
   - `~/.pi/agent/{git,npm}` for global package installs;
   - `.pi/{git,npm}` for project-local package installs;
   - package manifests and pinned refs when package source is present.
2. Classify each package or package candidate:
   - `global`: reusable across most coding work and stable enough for every repo;
   - `project-local`: needed only by the current repo and should live under `.pi/`;
   - `experimental`: useful to try, but should not enter persistent config yet;
   - `remove`: duplicate, stale, unpinned when it should be pinned, or no longer used.
3. For external package research, use `tavily-cli` first when available.
4. Recommend an update policy:
   - update Pi itself separately from packages;
   - update one package at a time unless the package set is small and low-risk;
   - keep git packages pinned to tags or commits when reproducibility matters;
   - use project-local installs for repo-specific extensions, skills, prompts, or themes.
5. If I explicitly approve changes, make the smallest change:
   - use `pi install`, `pi remove`, `pi update`, or direct settings edits as appropriate;
   - keep global and project-local package scopes separate;
   - do not commit package caches or runtime install directories.
6. Validate after changes:
   - `jq . ~/.pi/agent/settings.json`;
   - `jq . .pi/settings.json` when project settings exist;
   - `PI_OFFLINE=1 pi --help`;
   - `pi list` when package state changed.

Constraints:

- Do not install, update, remove, or enable packages without explicit approval after the audit.
- Do not move repo-specific package requirements into global settings.
- Do not add unpinned git packages when the package affects editing, shell commands, or persistent workflow behavior.
- Do not include runtime package directories in version control.

Output:

- Current package state.
- Classification table.
- Recommended action, if any.
- Exact commands to run only when changes are approved.
