#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PI_BIN="$(command -v pi || true)"
if [ -z "$PI_BIN" ]; then
	printf 'pi-session-auto-title load smoke: pi is required\n' >&2
	exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
TARGET_EXTENSIONS="$TEMP_DIR/home/.pi/agent/extensions"
mkdir -p "$TARGET_EXTENSIONS/session-auto-title" "$TEMP_DIR/tmp"
cp "$ROOT/agent/extensions/session-auto-title.ts" "$TARGET_EXTENSIONS/"
cp "$ROOT/agent/extensions/session-auto-title.json" "$TARGET_EXTENSIONS/"
cp -R "$ROOT/agent/extensions/session-auto-title/." "$TARGET_EXTENSIONS/session-auto-title/"

run_pi_extension() {
	local extension_path="$1"
	env -i \
		HOME="$TEMP_DIR/home" \
		PI_CODING_AGENT_DIR="$TEMP_DIR/home/.pi/agent" \
		PI_OFFLINE=1 \
		TMPDIR="$TEMP_DIR/tmp" \
		PATH="$PATH" \
		LC_ALL=C \
		LANG=C \
		"$PI_BIN" \
		--offline \
		--no-extensions \
		--extension "$extension_path" \
		--mode rpc \
		--no-session
}

BAD_EXTENSION="$TEMP_DIR/bad-extension.ts"
printf '%s\n' 'export default function broken( {' >"$BAD_EXTENSION"
if run_pi_extension "$BAD_EXTENSION" >"$TEMP_DIR/bad-stdout" 2>"$TEMP_DIR/bad-stderr" </dev/null; then
	printf 'pi-session-auto-title load smoke: invalid extension was not loaded\n' >&2
	exit 1
fi
if ! grep -F "Failed to load extension" "$TEMP_DIR/bad-stderr" >/dev/null; then
	printf 'pi-session-auto-title load smoke: loader control failed for an unexpected reason\n' >&2
	exit 1
fi

if ! run_pi_extension "$TARGET_EXTENSIONS/session-auto-title.ts" >"$TEMP_DIR/stdout" 2>"$TEMP_DIR/stderr" </dev/null; then
	cat "$TEMP_DIR/stderr" >&2
	exit 1
fi

if grep -F "Failed to load extension" "$TEMP_DIR/stdout" "$TEMP_DIR/stderr" >/dev/null 2>&1; then
	cat "$TEMP_DIR/stderr" >&2
	exit 1
fi
printf 'pi-session-auto-title load smoke passed\n'
