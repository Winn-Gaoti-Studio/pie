#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${PI_AGENT_HOME:-$HOME/.pi/agent}"

mkdir -p "$TARGET"

for file in settings.json keybindings.json; do
	install -m 600 "$ROOT/agent/$file" "$TARGET/$file"
done

for directory in docs extensions prompts themes; do
	mkdir -p "$TARGET/$directory"
	cp -R "$ROOT/agent/$directory/." "$TARGET/$directory/"
done

if [ -f "$HOME/.agents/AGENTS.md" ]; then
	ln -sfn ../../.agents/AGENTS.md "$TARGET/AGENTS.md"
fi

printf 'Installed Pie configuration in %s\n' "$TARGET"
