import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	DEFAULT_CONFIG,
	createConfigStore,
	modelToRef,
	normalizeConfig,
	parseModelRef,
} from "../../agent/extensions/session-auto-title/config.ts";

test("normalizes config while ignoring the retired startup rename option", () => {
	const config = normalizeConfig({
		enabled: false,
		model: { provider: "  test  ", id: " model ", reasoning: "light" },
		auto: {
			trigger: "something-else",
			overwriteExisting: true,
			renameExistingOnStart: true,
			confirmOverwrite: false,
			startupSummaryMessages: 999,
		},
		title: { maxLength: 999, maxInputChars: 0, maxOutputTokens: 2.8, timeoutMs: 0 },
	});

	assert.equal(config.enabled, false);
	assert.deepEqual(config.model, { provider: "test", id: "model", reasoning: "low" });
	assert.deepEqual(config.auto, {
		trigger: "after-first-assistant",
		overwriteExisting: true,
		confirmOverwrite: false,
		startupSummaryMessages: 50,
	});
	assert.equal("renameExistingOnStart" in config.auto, false);
	assert.equal(config.title.maxLength, 160);
	assert.equal(config.title.maxInputChars, DEFAULT_CONFIG.title.maxInputChars);
	assert.equal(config.title.maxOutputTokens, 2);
	assert.equal(config.title.timeoutMs, DEFAULT_CONFIG.title.timeoutMs);
});

test("clamps and defaults the title timeoutMs field", () => {
	assert.equal(normalizeConfig({ title: { timeoutMs: 5 } }).title.timeoutMs, 5);
	assert.equal(normalizeConfig({ title: { timeoutMs: 999999 } }).title.timeoutMs, 120000);
});

test("parses and formats model references without changing the current syntax", () => {
	assert.deepEqual(parseModelRef(" openai/gpt-5.5:light "), {
		provider: "openai",
		id: "gpt-5.5",
		reasoning: "low",
	});
	assert.deepEqual(parseModelRef("provider/model"), { provider: "provider", id: "model" });
	assert.equal(parseModelRef("model-only"), null);
	assert.equal(modelToRef({ provider: "provider", id: "model", reasoning: "xhigh" }), "provider/model:xhigh");
});

test("reads and writes config through an isolated explicit path", () => {
	const root = mkdtempSync(join(tmpdir(), "pi-auto-title-config-"));
	try {
		const path = join(root, "nested", "session-auto-title.json");
		const store = createConfigStore(path);

		assert.deepEqual(store.read(), DEFAULT_CONFIG);
		const config = normalizeConfig({ ...DEFAULT_CONFIG, enabled: false });
		assert.equal(store.write(config), true);
		assert.deepEqual(store.read(), config);
		assert.equal(JSON.parse(readFileSync(path, "utf8")).enabled, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
