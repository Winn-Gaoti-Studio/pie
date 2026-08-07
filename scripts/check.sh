#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! node --experimental-strip-types --check "$ROOT/agent/extensions/session-auto-title.ts" >/dev/null 2>&1; then
	printf 'Node.js with --experimental-strip-types support is required\n' >&2
	exit 2
fi

while IFS= read -r -d '' file; do
	case "$file" in
		*.json) jq empty "$file" ;;
		*.ts) node --experimental-strip-types --check "$file" ;;
	esac
done < <(find "$ROOT/agent" -type f -print0)

while IFS= read -r -d '' test_file; do
	node --experimental-strip-types "$test_file"
done < <(find "$ROOT/scripts/tests" -type f -name '*.test.ts' -print0)

git -C "$ROOT" diff --check
