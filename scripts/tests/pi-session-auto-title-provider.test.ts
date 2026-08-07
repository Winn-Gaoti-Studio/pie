import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CONFIG } from "../../agent/extensions/session-auto-title/config.ts";
import { createTitleProvider } from "../../agent/extensions/session-auto-title/provider.ts";

test("uses injected auth and completion gateways once with the existing completion options", async () => {
	const events: string[] = [];
	const notices: Array<[string, string]> = [];
	const model = { provider: "openai", id: "gpt-5.5" };
	let completionCalls = 0;
	const provider = createTitleProvider({
		notify: (_context, message, level) => notices.push([message, level]),
		complete: async (selectedModel, context, options) => {
			completionCalls += 1;
			events.push("complete");
			assert.equal(selectedModel, model);
			assert.equal(context.systemPrompt, "You create concise, descriptive session titles for coding-agent chat sessions.");
			assert.equal(context.messages.length, 1);
			assert.equal(options.apiKey, "fake-key");
			assert.deepEqual(options.headers, { "x-test": "fake" });
			assert.equal(options.maxTokens, 1024);
			assert.equal(options.reasoning, "low");
			assert.equal(options.maxRetries, 0);
			assert.equal(options.timeoutMs, 15000);
			assert.ok(options.signal instanceof AbortSignal);
			return { stopReason: "stop", content: [{ type: "text", text: "  `Useful Title!`  " }] };
		},
	});
	const context = {
		modelRegistry: {
			find: () => model,
			getApiKeyAndHeaders: async () => ({ ok: true as const, apiKey: "fake-key", headers: { "x-test": "fake" } }),
		},
	};

	const title = await provider.generate({
		context,
		config: DEFAULT_CONFIG,
		sourceLabel: "Session history",
		sourceText: "User: task",
		startLoading: () => {
			events.push("start");
			return () => events.push("stop");
		},
	});

	assert.equal(title, "Useful Title");
	assert.equal(completionCalls, 1);
	assert.deepEqual(events, ["start", "complete", "stop"]);
	assert.deepEqual(notices, []);
});

test("aborts and returns null when the completion exceeds timeoutMs", async () => {
	const events: string[] = [];
	const notices: Array<[string, string]> = [];
	const model = { provider: "openai", id: "gpt-5.5" };
	let completionCalls = 0;
	const provider = createTitleProvider({
		notify: (_context, message, level) => notices.push([message, level]),
		complete: async (_selectedModel, _context, options) =>
			new Promise((_resolve, reject) => {
				completionCalls += 1;
				options.signal.addEventListener("abort", () => reject(new Error("aborted")));
			}),
	});
	const context = {
		modelRegistry: {
			find: () => model,
			getApiKeyAndHeaders: async () => ({ ok: true as const, apiKey: "fake-key" }),
		},
	};

	const startedAt = Date.now();
	const title = await provider.generate({
		context,
		config: { ...DEFAULT_CONFIG, title: { ...DEFAULT_CONFIG.title, timeoutMs: 5 } },
		sourceLabel: "Session history",
		sourceText: "User: task",
		startLoading: () => {
			events.push("start");
			return () => events.push("stop");
		},
	});

	assert.equal(title, null);
	assert.equal(completionCalls, 1);
	assert.ok(Date.now() - startedAt < 2000);
	assert.deepEqual(notices, [["Auto-title timed out after 5ms", "warning"]]);
	assert.deepEqual(events, ["start", "stop"]);
});

test("fails before loading when auth is unavailable", async () => {
	let loadingStarted = false;
	let completionCalls = 0;
	const notices: Array<[string, string]> = [];
	const provider = createTitleProvider({
		notify: (_context, message, level) => notices.push([message, level]),
		complete: async () => {
			completionCalls += 1;
			return { stopReason: "stop", content: [] };
		},
	});
	const context = {
		modelRegistry: {
			find: () => ({ provider: "openai", id: "gpt-5.5" }),
			getApiKeyAndHeaders: async () => ({ ok: false as const, error: "fake auth failure" }),
		},
	};

	assert.equal(await provider.ensureAvailable(context, DEFAULT_CONFIG.model), false);
	assert.equal(
		await provider.generate({
			context,
			config: DEFAULT_CONFIG,
			sourceLabel: "Session history",
			sourceText: "User: task",
			startLoading: () => {
				loadingStarted = true;
				return () => undefined;
			},
		}),
		null,
	);
	assert.equal(loadingStarted, false);
	assert.equal(completionCalls, 0);
	assert.deepEqual(notices, [
		["fake auth failure", "warning"],
		["fake auth failure", "warning"],
	]);
});

test("does not retry a failed completion", async () => {
	let completionCalls = 0;
	const notices: Array<[string, string]> = [];
	const provider = createTitleProvider({
		notify: (_context, message, level) => notices.push([message, level]),
		complete: async () => {
			completionCalls += 1;
			throw new Error("fake completion failure");
		},
	});
	const context = {
		modelRegistry: {
			find: () => ({ provider: "openai", id: "gpt-5.5" }),
			getApiKeyAndHeaders: async () => ({ ok: true as const, apiKey: "fake-key" }),
		},
	};

	assert.equal(
		await provider.generate({
			context,
			config: DEFAULT_CONFIG,
			sourceLabel: "Session history",
			sourceText: "User: task",
			startLoading: () => () => undefined,
		}),
		null,
	);
	assert.equal(completionCalls, 1);
	assert.deepEqual(notices, [["Failed to generate session title: fake completion failure", "warning"]]);
});

test("keeps the command-specific missing-model diagnostic", async () => {
	const notices: Array<[string, string]> = [];
	const provider = createTitleProvider({
		notify: (_context, message, level) => notices.push([message, level]),
		complete: async () => ({ stopReason: "stop", content: [] }),
	});
	const context = {
		modelRegistry: {
			find: () => undefined,
			getApiKeyAndHeaders: async () => ({ ok: false as const, error: "unreachable" }),
		},
	};

	assert.equal(await provider.ensureAvailable(context, DEFAULT_CONFIG.model), false);
	assert.deepEqual(notices, [["Model not found: openai/gpt-5.5", "warning"]]);
});
